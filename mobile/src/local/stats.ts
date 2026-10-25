import { computeStats, type StatsInput } from "@/lib/insights";
import { db } from "./db";
import { listGroupRefs, listPersonsWithGroups } from "./queries";

// The phone's version of lib/stats.ts: the raw rows from SQLite, worked out
// by the same code the web app's numbers are checked against.
export async function getStats(timeZone: string) {
  const [entries, links, thoughts, persons, groups, memberships] =
    await Promise.all([
      db.all<{ id: number; loggedAt: string; mediumTags: string }>(
        "SELECT id, loggedAt, mediumTags FROM entries",
      ),
      db.all<{ entryId: number; personId: number }>(
        "SELECT entryId, personId FROM entryPersons",
      ),
      db.all<{ entryId: number; tag: string; personIds: string }>(
        "SELECT entryId, tag, personIds FROM entryThoughts ORDER BY id",
      ),
      listPersonsWithGroups(),
      listGroupRefs(),
      db.all<{ personId: number; groupId: number }>(
        "SELECT personId, groupId FROM memberships",
      ),
    ]);

  const byEntry = new Map<number, StatsInput["entries"][number]>(
    entries.map((e) => [
      e.id,
      {
        id: e.id,
        loggedAt: e.loggedAt,
        mediumTags: JSON.parse(e.mediumTags),
        personIds: [],
        thoughts: [],
      },
    ]),
  );
  for (const l of links) byEntry.get(l.entryId)?.personIds.push(l.personId);
  for (const t of thoughts)
    byEntry
      .get(t.entryId)
      ?.thoughts.push({ tag: t.tag, personIds: JSON.parse(t.personIds) });

  return computeStats(
    { entries: [...byEntry.values()], persons, groups, memberships },
    timeZone,
  );
}
