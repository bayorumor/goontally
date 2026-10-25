// Closes the gaps in ids left by deleted rows, e.g. persons 1, 2, 7, 9
// become 1, 2, 3, 4, keeping their order. Run from the repo root:
//
//   npm run db:renumber            # dry run: shows the result, changes nothing
//   npm run db:renumber -- --apply # does it
//
// Covers persons, groups, entries, finishes and custom options; links
// between them follow along. User ids stay as they are (signed-in sessions
// carry them); only their counter is reset. A full JSON backup is written
// to backups/ first, and everything runs in one transaction that rolls back
// unless the data, described by names and values rather than ids, comes out
// identical.
//
// Page links like /persons/12 change for renumbered rows, so run it while
// nobody is using the app.

import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env");
const apply = process.argv.includes("--apply");

const RENUMBERED = ["Person", "Group", "Entry", "EntryThought", "UserCustomOption"];
const ALL = ["User", "Person", "Group", "PersonGroup", "Entry", "EntryPerson", "EntryThought", "UserCustomOption"];

// Everything that matters, described by names and values instead of ids.
const FINGERPRINT = `
SELECT md5(string_agg(x, E'\\n' ORDER BY x)) AS h, count(*)::int AS n FROM (
  SELECT 'P|' || p."userId" || '|' || p.name || '|' || coalesce(p."photoUrl", '') || '|' ||
         coalesce((SELECT string_agg(g.name, ',' ORDER BY g.name) FROM "PersonGroup" pg
                   JOIN "Group" g ON g.id = pg."groupId" WHERE pg."personId" = p.id), '') AS x
  FROM "Person" p
  UNION ALL
  SELECT 'G|' || g."userId" || '|' || g.name || '|' || coalesce(g."photoUrl", '') FROM "Group" g
  UNION ALL
  SELECT 'E|' || e."userId" || '|' || e."loggedAt" || '|' || e."createdAt" || '|' ||
         array_to_string(e."mediumTags", ',') || '|' || coalesce(e.notes, '') || '|' ||
         coalesce((SELECT string_agg(p.name, ',' ORDER BY p.name) FROM "EntryPerson" ep
                   JOIN "Person" p ON p.id = ep."personId" WHERE ep."entryId" = e.id), '') || '|' ||
         coalesce((SELECT string_agg(t.tag || '>' || coalesce((SELECT string_agg(p.name, '+' ORDER BY p.name)
                   FROM unnest(t."personIds") pid JOIN "Person" p ON p.id = pid), '?'), ',' ORDER BY t.tag)
                   FROM "EntryThought" t WHERE t."entryId" = e.id), '')
  FROM "Entry" e
  UNION ALL
  SELECT 'O|' || o."userId" || '|' || o.category || '|' || o.label || '|' || o.hidden FROM "UserCustomOption" o
) s`;

const db = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
await db.connect();
const rows = async (sql) => (await db.query(sql)).rows;
const count = async (t) => (await rows(`SELECT count(*)::int n FROM "${t}"`))[0].n;

try {
  // 1. Backup, before anything changes.
  const backup = {};
  for (const t of ALL) backup[t] = await rows(`SELECT * FROM "${t}"`);
  mkdirSync("backups", { recursive: true });
  const file = `backups/db-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(backup));
  console.log(`Backup: ${file}`);

  // 2. Renumber in one transaction, with the tables locked.
  await db.query("BEGIN");
  await db.query(`LOCK TABLE ${ALL.map((t) => `"${t}"`).join(", ")} IN EXCLUSIVE MODE`);

  const [orphans] = await rows(`SELECT count(*)::int n FROM "EntryThought" t, unnest(t."personIds") pid
                                WHERE NOT EXISTS (SELECT 1 FROM "Person" p WHERE p.id = pid)`);
  if (orphans.n) throw new Error(`${orphans.n} finish(es) point at missing persons`);

  const [before] = await rows(FINGERPRINT);
  const counts = {};
  for (const t of ALL) counts[t] = await count(t);

  for (const t of RENUMBERED) {
    await db.query(`CREATE TEMP TABLE map_${t} ON COMMIT DROP AS
                    SELECT id AS old, row_number() OVER (ORDER BY id)::int AS new FROM "${t}"`);
    // Via negative ids, so no step ever collides with an id still in use.
    // Foreign keys are ON UPDATE CASCADE, so links follow automatically.
    await db.query(`UPDATE "${t}" SET id = -id`);
    await db.query(`UPDATE "${t}" x SET id = m.new FROM map_${t} m WHERE x.id = -m.old`);
    // Finishes list their persons in an array without a foreign key.
    if (t === "Person")
      await db.query(`UPDATE "EntryThought" t SET "personIds" = ARRAY(
                        SELECT m.new FROM unnest(t."personIds") WITH ORDINALITY u(pid, ord)
                        JOIN map_Person m ON m.old = u.pid ORDER BY u.ord)`);
  }
  for (const t of [...RENUMBERED, "User"])
    await db.query(`SELECT setval('"${t}_id_seq"', coalesce((SELECT max(id) FROM "${t}"), 1),
                                  (SELECT count(*) > 0 FROM "${t}"))`);

  // 3. Prove nothing was lost or re-linked wrongly.
  const [after] = await rows(FINGERPRINT);
  for (const t of ALL)
    if ((await count(t)) !== counts[t]) throw new Error(`${t} row count changed`);
  if (before.h !== after.h || before.n !== after.n)
    throw new Error("the data changed while renumbering");

  for (const t of RENUMBERED) {
    const [r] = await rows(`SELECT count(*)::int n, max(id) hi FROM "${t}"`);
    console.log(`${t.padEnd(16)} ${r.n} rows, ids 1..${r.hi ?? 0}`);
  }
  console.log(`Data check: identical (${before.n} records)`);

  if (apply) {
    await db.query("COMMIT");
    console.log("✓ Done");
  } else {
    await db.query("ROLLBACK");
    console.log("Dry run: nothing changed. Run with -- --apply to do it.");
  }
} catch (err) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(`✗ Rolled back, nothing changed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
