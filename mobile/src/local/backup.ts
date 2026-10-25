import type { BackupData, ImportMode, ImportResult } from "@/lib/backup/format";
import { db, type Tx } from "./db";
import { deletePhoto, photoSrc } from "./photos";

// The phone's version of lib/backup/server.ts: the rows for a backup, and
// writing a backup's rows back. Packing the file and moving photos is done
// by the same browser code the web app uses (lib/backup/client.ts).

// Backup times may carry any offset; the phone stores them as UTC ISO
// strings, which sort correctly as text.
const iso = (time: string) => new Date(time).toISOString();

type Named = {
  id: number;
  name: string;
  photo: string | null;
  createdAt: string;
};

// Everything on the phone, in backup shape. `photo` holds a URL the WebView
// can fetch; the packing code swaps it for the photo's path in the zip.
export async function exportRows(): Promise<BackupData> {
  const [persons, groups, memberships, entries, links, thoughts, options] =
    await Promise.all([
      db.all<Named>(
        "SELECT id, name, photo, createdAt FROM persons ORDER BY id",
      ),
      db.all<Named>(
        "SELECT id, name, photo, createdAt FROM groups ORDER BY id",
      ),
      db.all<{ personId: number; groupId: number; joinedAt: string }>(
        "SELECT personId, groupId, joinedAt FROM memberships",
      ),
      db.all<{
        id: number;
        loggedAt: string;
        mediumTags: string;
        notes: string | null;
        createdAt: string;
      }>(
        "SELECT id, loggedAt, mediumTags, notes, createdAt FROM entries ORDER BY loggedAt, id",
      ),
      db.all<{ entryId: number; personId: number }>(
        "SELECT entryId, personId FROM entryPersons",
      ),
      db.all<{ entryId: number; tag: string; personIds: string }>(
        "SELECT entryId, tag, personIds FROM entryThoughts ORDER BY id",
      ),
      db.all<{ category: string; label: string; createdAt: string }>(
        "SELECT category, label, createdAt FROM customOptions ORDER BY createdAt",
      ),
    ]);

  const named = (r: Named) => ({
    id: r.id,
    name: r.name,
    photo: photoSrc(r.photo),
    createdAt: r.createdAt,
  });

  return {
    persons: persons.map(named),
    groups: groups.map(named),
    memberships,
    entries: entries.map((e) => ({
      loggedAt: e.loggedAt,
      mediumTags: JSON.parse(e.mediumTags),
      notes: e.notes,
      personIds: links.filter((l) => l.entryId === e.id).map((l) => l.personId),
      thoughts: thoughts
        .filter((t) => t.entryId === e.id)
        .map((t) => ({ tag: t.tag, personIds: JSON.parse(t.personIds) })),
      createdAt: e.createdAt,
    })),
    options: options.flatMap((o) =>
      o.category === "thought" || o.category === "medium"
        ? [{ category: o.category, label: o.label, createdAt: o.createdAt }]
        : [],
    ),
  };
}

// Writes a backup's rows in one transaction, with the web app's rules:
// persons and groups match by name ignoring case, an entry counts as the
// same when it has the same time and persons, and "replace" empties the
// phone first. Missing photos are filled, existing ones never replaced.
export async function importRows(
  data: BackupData,
  mode: ImportMode,
): Promise<ImportResult> {
  const { result, oldPhotos } = await db.transaction(async (tx) => {
    let oldPhotos: string[] = [];
    if (mode === "replace") {
      oldPhotos = (
        await tx.all<{ photo: string }>(
          "SELECT photo FROM persons WHERE photo IS NOT NULL UNION ALL SELECT photo FROM groups WHERE photo IS NOT NULL",
        )
      ).map((r) => r.photo);
      // Memberships, entry persons and thoughts go with them (cascade).
      for (const table of ["entries", "persons", "groups", "customOptions"])
        await tx.run(`DELETE FROM ${table}`);
    }

    const photos: ImportResult["photos"] = [];

    // New rows get ids picked here, so they can be inserted many at a time:
    // each statement is one trip to the native side, and those trips, not
    // SQLite, are what made row-by-row imports slow.
    const nextId = async (table: string) => {
      const row = await tx.get<{ id: number }>(
        `SELECT MAX(COALESCE((SELECT seq FROM sqlite_sequence WHERE name = ?), 0),
                COALESCE((SELECT MAX(id) FROM ${table}), 0)) + 1 AS id`,
        [table],
      );
      return row!.id;
    };

    // File id → phone id, creating what's missing.
    const resolveNamed = async (kind: "person" | "group") => {
      const table = kind === "person" ? "persons" : "groups";
      const rows = kind === "person" ? data.persons : data.groups;
      const existing = await tx.all<{
        id: number;
        name: string;
        photo: string | null;
      }>(`SELECT id, name, photo FROM ${table}`);
      const byName = new Map(
        existing.map((r) => [
          r.name.toLowerCase(),
          { id: r.id, hasPhoto: !!r.photo },
        ]),
      );

      let id = await nextId(table);
      const fresh: unknown[][] = [];
      const ids = new Map<number, number>();
      const wantsPhoto = new Set<number>();
      for (const r of rows) {
        const key = r.name.toLowerCase();
        let match = byName.get(key);
        if (!match) {
          match = { id: id++, hasPhoto: false };
          byName.set(key, match);
          fresh.push([match.id, r.name, iso(r.createdAt), iso(r.createdAt)]);
        }
        ids.set(r.id, match.id);
        if (r.photo && !match.hasPhoto && !wantsPhoto.has(match.id)) {
          wantsPhoto.add(match.id);
          photos.push({ path: r.photo, kind, id: match.id });
        }
      }
      await insertMany(
        tx,
        table,
        ["id", "name", "createdAt", "updatedAt"],
        fresh,
      );
      return { ids, added: fresh.length };
    };

    const persons = await resolveNamed("person");
    const groups = await resolveNamed("group");
    const personId = (id: number) => persons.ids.get(id)!;

    await insertMany(
      tx,
      "memberships",
      ["personId", "groupId", "joinedAt"],
      data.memberships.map((m) => [
        personId(m.personId),
        groups.ids.get(m.groupId)!,
        iso(m.joinedAt),
      ]),
      "OR IGNORE",
    );

    const entryKey = (loggedAt: string, ids: number[]) =>
      `${Date.parse(loggedAt)}:${[...ids].sort((a, b) => a - b).join(",")}`;
    const seen = new Set<string>();
    if (mode === "merge") {
      const rows = await tx.all<{ loggedAt: string; ids: string }>(
        `SELECT e.loggedAt, GROUP_CONCAT(ep.personId) AS ids
         FROM entries e JOIN entryPersons ep ON ep.entryId = e.id
         GROUP BY e.id`,
      );
      for (const r of rows)
        seen.add(entryKey(r.loggedAt, r.ids.split(",").map(Number)));
    }

    let entryId = await nextId("entries");
    const entryRows: unknown[][] = [];
    const personRows: unknown[][] = [];
    const thoughtRows: unknown[][] = [];
    for (const e of data.entries) {
      const ids = [...new Set(e.personIds.map(personId))];
      const key = entryKey(e.loggedAt, ids);
      if (seen.has(key)) continue;
      seen.add(key);

      const id = entryId++;
      entryRows.push([
        id,
        iso(e.loggedAt),
        JSON.stringify(e.mediumTags),
        e.notes || null,
        iso(e.createdAt),
        iso(e.createdAt),
      ]);
      for (const p of ids) personRows.push([id, p]);
      // Same rule as the log form: a thought about nobody is about everyone.
      for (const t of e.thoughts) {
        const about = [...new Set(t.personIds.map(personId))];
        thoughtRows.push([
          id,
          t.tag,
          JSON.stringify(about.length ? about : ids),
        ]);
      }
    }
    await insertMany(
      tx,
      "entries",
      ["id", "loggedAt", "mediumTags", "notes", "createdAt", "updatedAt"],
      entryRows,
    );
    await insertMany(tx, "entryPersons", ["entryId", "personId"], personRows);
    await insertMany(
      tx,
      "entryThoughts",
      ["entryId", "tag", "personIds"],
      thoughtRows,
    );

    await insertMany(
      tx,
      "customOptions",
      ["category", "label", "createdAt", "updatedAt"],
      data.options.map((o) => [
        o.category,
        o.label,
        iso(o.createdAt),
        iso(o.createdAt),
      ]),
      "OR IGNORE",
    );

    const addedEntries = entryRows.length;
    const result: ImportResult = {
      added: {
        persons: persons.added,
        groups: groups.added,
        entries: addedEntries,
      },
      skippedEntries: data.entries.length - addedEntries,
      photos,
    };
    return { result, oldPhotos };
  });

  // The old rows are gone, so their photo files are unused now.
  for (const photo of oldPhotos) await deletePhoto(photo);
  return result;
}

// Points the given persons and groups at their newly stored photo files, a
// batch of rows per statement.
export async function setPhotos(
  rows: { kind: "person" | "group"; id: number; photo: string }[],
) {
  const at = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const kind of ["person", "group"] as const) {
      const table = kind === "person" ? "persons" : "groups";
      const list = rows.filter((r) => r.kind === kind);
      for (let i = 0; i < list.length; i += 300) {
        const batch = list.slice(i, i + 300);
        await tx.run(
          `UPDATE ${table}
           SET photo = CASE id ${batch.map(() => "WHEN ? THEN ?").join(" ")} END,
               updatedAt = ?
           WHERE id IN (${batch.map(() => "?").join(", ")})`,
          [
            ...batch.flatMap((r) => [r.id, r.photo]),
            at,
            ...batch.map((r) => r.id),
          ],
        );
      }
    }
  });
}

// One INSERT per batch of rows. SQLite caps the values in one statement
// (999 on older versions), so batches stay under that.
async function insertMany(
  tx: Tx,
  table: string,
  columns: string[],
  rows: unknown[][],
  conflict = "",
) {
  const perBatch = Math.floor(999 / columns.length);
  const row = `(${columns.map(() => "?").join(", ")})`;
  for (let i = 0; i < rows.length; i += perBatch) {
    const batch = rows.slice(i, i + perBatch);
    await tx.run(
      `INSERT ${conflict} INTO ${table} (${columns.join(", ")}) VALUES ${batch.map(() => row).join(", ")}`,
      batch.flat(),
    );
  }
}
