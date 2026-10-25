import {
  isDefault,
  renameIn,
  visibleOptions,
  type OptionCategory,
  type OptionList,
} from "@/lib/options";
import { db, type Tx } from "./db";

// The phone's version of lib/customOptions.ts: finishes and mediums offered
// when logging, and the "Log options" sheet's rename and remove.

const now = () => new Date().toISOString();

async function rows(category: OptionCategory, tx: Pick<Tx, "all"> = db) {
  const list = await tx.all<{ label: string; hidden: number }>(
    "SELECT label, hidden FROM customOptions WHERE category = ? ORDER BY createdAt, id",
    [category],
  );
  return list.map((r) => ({ label: r.label, hidden: !!r.hidden }));
}

// What the log sheet offers.
export async function listLogOptions(category: OptionCategory) {
  return visibleOptions(category, await rows(category));
}

// Every offered option with how many entries use it.
export async function listOptions(): Promise<OptionList> {
  const [thoughtRows, mediumRows, thoughtUses, entries] = await Promise.all([
    rows("thought"),
    rows("medium"),
    db.all<{ label: string; uses: number }>(
      "SELECT tag AS label, COUNT(DISTINCT entryId) AS uses FROM entryThoughts GROUP BY tag",
    ),
    db.all<{ mediumTags: string }>(
      "SELECT mediumTags FROM entries WHERE mediumTags <> '[]'",
    ),
  ]);
  const mediumUses = new Map<string, number>();
  for (const e of entries)
    for (const tag of new Set<string>(JSON.parse(e.mediumTags)))
      mediumUses.set(tag, (mediumUses.get(tag) ?? 0) + 1);

  const describe = (
    category: OptionCategory,
    optionRows: { label: string; hidden: boolean }[],
    uses: Map<string, number>,
  ) =>
    visibleOptions(category, optionRows).map((label) => ({
      label,
      isDefault: isDefault(category, label),
      uses: uses.get(label) ?? 0,
    }));

  return {
    thought: describe(
      "thought",
      thoughtRows,
      new Map(thoughtUses.map((u) => [u.label, u.uses])),
    ),
    medium: describe("medium", mediumRows, mediumUses),
  };
}

// Offers a label (again), adding its row when there's none.
async function offer(tx: Tx, category: OptionCategory, label: string) {
  const at = now();
  await tx.run(
    "INSERT OR IGNORE INTO customOptions (category, label, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
    [category, label, at, at],
  );
  await tx.run(
    "UPDATE customOptions SET hidden = 0, updatedAt = ? WHERE category = ? AND label = ? AND hidden = 1",
    [at, category, label],
  );
}

// Saved from the log sheet for next time.
export const addOption = (category: OptionCategory, label: string) =>
  db.transaction((tx) => offer(tx, category, label));

// Stops offering a label: a built-in one is marked hidden, the user's own
// is deleted.
async function retire(tx: Tx, category: OptionCategory, label: string) {
  if (!isDefault(category, label)) {
    await tx.run("DELETE FROM customOptions WHERE category = ? AND label = ?", [
      category,
      label,
    ]);
    return;
  }
  const at = now();
  await tx.run(
    "INSERT OR IGNORE INTO customOptions (category, label, hidden, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?)",
    [category, label, at, at],
  );
  await tx.run(
    "UPDATE customOptions SET hidden = 1, updatedAt = ? WHERE category = ? AND label = ?",
    [at, category, label],
  );
}

// Entries whose mediums include the label. instr() rather than LIKE, so
// "%" or "_" in a label match only themselves; the JSON is checked after.
async function entriesWithMedium(tx: Tx, label: string) {
  const list = await tx.all<{ id: number; mediumTags: string }>(
    "SELECT id, mediumTags FROM entries WHERE instr(mediumTags, ?) > 0",
    [JSON.stringify(label)],
  );
  return list
    .map((e) => ({ id: e.id, tags: JSON.parse(e.mediumTags) as string[] }))
    .filter((e) => e.tags.includes(label));
}

// Renames an option and every past use of it, merging into an option that
// already has the new name (ignoring case), as on the web.
export async function renameOption(
  category: OptionCategory,
  from: string,
  newName: string,
) {
  await db.transaction(async (tx) => {
    const offered = visibleOptions(category, await rows(category, tx));
    const to =
      offered.find(
        (o) => o !== from && o.toLowerCase() === newName.toLowerCase(),
      ) ?? newName;
    if (to === from) return;
    const at = now();

    if (category === "thought") {
      const list = await tx.all<{
        id: number;
        entryId: number;
        tag: string;
        personIds: string;
      }>(
        "SELECT id, entryId, tag, personIds FROM entryThoughts WHERE tag IN (?, ?)",
        [from, to],
      );
      for (const old of list.filter((t) => t.tag === from)) {
        const target = list.find(
          (t) => t.entryId === old.entryId && t.tag === to,
        );
        if (!target) {
          await tx.run("UPDATE entryThoughts SET tag = ? WHERE id = ?", [
            to,
            old.id,
          ]);
          continue;
        }
        // An entry with both: one finish, for everyone either was about.
        const ids = [
          ...new Set([
            ...(JSON.parse(target.personIds) as number[]),
            ...(JSON.parse(old.personIds) as number[]),
          ]),
        ];
        await tx.run("UPDATE entryThoughts SET personIds = ? WHERE id = ?", [
          JSON.stringify(ids),
          target.id,
        ]);
        await tx.run("DELETE FROM entryThoughts WHERE id = ?", [old.id]);
      }
    } else {
      for (const e of await entriesWithMedium(tx, from))
        await tx.run(
          "UPDATE entries SET mediumTags = ?, updatedAt = ? WHERE id = ?",
          [JSON.stringify(renameIn(e.tags, from, to)), at, e.id],
        );
    }

    await retire(tx, category, from);
    await offer(tx, category, to);
  });
}

// Stops offering an option. Past entries keep it unless fromEntries is set.
export async function removeOption(
  category: OptionCategory,
  label: string,
  fromEntries: boolean,
) {
  await db.transaction(async (tx) => {
    await retire(tx, category, label);
    if (!fromEntries) return;
    if (category === "thought")
      await tx.run("DELETE FROM entryThoughts WHERE tag = ?", [label]);
    else
      for (const e of await entriesWithMedium(tx, label))
        await tx.run(
          "UPDATE entries SET mediumTags = ?, updatedAt = ? WHERE id = ?",
          [JSON.stringify(e.tags.filter((t) => t !== label)), now(), e.id],
        );
  });
}
