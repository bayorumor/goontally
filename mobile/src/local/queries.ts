import type {
  Entry,
  Group,
  GroupRef,
  GroupStats,
  GroupWithMembers,
  Person,
  PersonSummary,
  PersonWithCount,
} from "@/lib/types";
import { db } from "./db";
import { photoSrc } from "./photos";

// The phone's version of lib/queries.ts: same function names, same shapes,
// read from SQLite. There's no userId, as everything on the phone is the
// user's.

type NamedRow = { id: number; name: string; photo: string | null };

const summary = (r: NamedRow): PersonSummary => ({
  id: r.id,
  name: r.name,
  photoUrl: photoSrc(r.photo),
});

// Groups of each person, by person id.
async function groupsByPerson(personIds?: number[]) {
  const rows = await db.all<{ personId: number; id: number; name: string }>(
    `SELECT m.personId, g.id, g.name
     FROM memberships m JOIN groups g ON g.id = m.groupId
     ${personIds ? `WHERE m.personId IN (${personIds.map(() => "?").join(",")})` : ""}
     ORDER BY g.name`,
    personIds,
  );
  const map = new Map<number, GroupRef[]>();
  for (const r of rows) {
    const list = map.get(r.personId) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.personId, list);
  }
  return map;
}

export async function listPersons(
  sort: "name" | "lastLogged",
): Promise<PersonWithCount[]> {
  const rows = await db.all<NamedRow & { entryCount: number }>(
    sort === "lastLogged"
      ? // Only persons that have been logged, most recent first.
        `SELECT p.id, p.name, p.photo, COUNT(ep.entryId) AS entryCount
         FROM persons p
         JOIN entryPersons ep ON ep.personId = p.id
         JOIN entries e ON e.id = ep.entryId
         GROUP BY p.id
         ORDER BY MAX(e.loggedAt) DESC`
      : `SELECT p.id, p.name, p.photo,
           (SELECT COUNT(*) FROM entryPersons ep WHERE ep.personId = p.id) AS entryCount
         FROM persons p
         ORDER BY p.name`,
  );
  const groups = await groupsByPerson();
  return rows.map((r) => ({
    ...summary(r),
    groups: groups.get(r.id) ?? [],
    entryCount: r.entryCount,
  }));
}

// Every person with their groups, for the log/add pickers.
export async function listPersonsWithGroups(): Promise<Person[]> {
  const rows = await db.all<NamedRow>(
    "SELECT id, name, photo FROM persons ORDER BY name",
  );
  const groups = await groupsByPerson();
  return rows.map((r) => ({ ...summary(r), groups: groups.get(r.id) ?? [] }));
}

// Persons for the quick-log picker: most recently logged first, then the
// never-logged ones by name.
export async function listPersonsForPicker(): Promise<Person[]> {
  const [persons, recent] = await Promise.all([
    listPersonsWithGroups(),
    db.all<{ id: number }>(
      `SELECT ep.personId AS id
       FROM entryPersons ep JOIN entries e ON e.id = ep.entryId
       GROUP BY ep.personId
       ORDER BY MAX(e.loggedAt) DESC`,
    ),
  ]);
  const rank = new Map(recent.map((r, i) => [r.id, i]));
  return persons.sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );
}

async function membersOf(groupIds: number[]) {
  const rows = groupIds.length
    ? await db.all<NamedRow & { groupId: number }>(
        `SELECT m.groupId, p.id, p.name, p.photo
         FROM memberships m JOIN persons p ON p.id = m.personId
         WHERE m.groupId IN (${groupIds.map(() => "?").join(",")})
         ORDER BY p.name`,
        groupIds,
      )
    : [];
  const map = new Map<number, PersonSummary[]>();
  for (const r of rows) {
    const list = map.get(r.groupId) ?? [];
    list.push(summary(r));
    map.set(r.groupId, list);
  }
  return map;
}

export async function listGroups(): Promise<GroupWithMembers[]> {
  const groups = await listGroupRefs();
  const members = await membersOf(groups.map((g) => g.id));
  return groups.map((g) => ({ ...g, persons: members.get(g.id) ?? [] }));
}

export async function listGroupRefs(): Promise<Group[]> {
  const rows = await db.all<NamedRow>(
    "SELECT id, name, photo FROM groups ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    photoUrl: photoSrc(r.photo),
  }));
}

export async function getGroupDetail(
  groupId: number,
): Promise<{ group: GroupWithMembers; stats: GroupStats } | null> {
  const row = await db.get<NamedRow>(
    "SELECT id, name, photo FROM groups WHERE id = ?",
    [groupId],
  );
  if (!row) return null;
  const members = (await membersOf([groupId])).get(groupId) ?? [];

  const [counts, total] = await Promise.all([
    db.all<{ personId: number; count: number }>(
      `SELECT ep.personId, COUNT(*) AS count
       FROM entryPersons ep JOIN memberships m ON m.personId = ep.personId
       WHERE m.groupId = ?
       GROUP BY ep.personId
       ORDER BY count DESC`,
      [groupId],
    ),
    // Entries with any member, each counted once even when several members
    // are in it.
    db.get<{ total: number }>(
      `SELECT COUNT(DISTINCT ep.entryId) AS total
       FROM entryPersons ep JOIN memberships m ON m.personId = ep.personId
       WHERE m.groupId = ?`,
      [groupId],
    ),
  ]);

  const memberCounts: Record<number, number> = {};
  for (const c of counts) memberCounts[c.personId] = c.count;
  const top = counts[0];
  const topMember = top && members.find((m) => m.id === top.personId);

  return {
    group: {
      id: row.id,
      name: row.name,
      photoUrl: photoSrc(row.photo),
      persons: members,
    },
    stats: {
      totalEntries: total?.total ?? 0,
      topPerson: topMember ? { ...topMember, entryCount: top.count } : null,
      memberCounts,
    },
  };
}

export async function getPerson(personId: number): Promise<Person | null> {
  const row = await db.get<NamedRow>(
    "SELECT id, name, photo FROM persons WHERE id = ?",
    [personId],
  );
  if (!row) return null;
  const groups = await groupsByPerson([personId]);
  return { ...summary(row), groups: groups.get(personId) ?? [] };
}

// Newest first. Pages continue after the last entry already shown (`after`),
// so entries added or deleted meanwhile never shift what comes next.
export async function listEntries(opts: {
  personId?: number;
  limit: number;
  after?: { loggedAt: string; id: number };
}): Promise<{ entries: Entry[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.personId) {
    where.push("id IN (SELECT entryId FROM entryPersons WHERE personId = ?)");
    params.push(opts.personId);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const page = [...where];
  const pageParams = [...params];
  if (opts.after) {
    page.push("(loggedAt < ? OR (loggedAt = ? AND id < ?))");
    pageParams.push(opts.after.loggedAt, opts.after.loggedAt, opts.after.id);
  }
  const pageFilter = page.length ? `WHERE ${page.join(" AND ")}` : "";

  const [rows, count] = await Promise.all([
    db.all<{
      id: number;
      loggedAt: string;
      mediumTags: string;
      notes: string | null;
    }>(
      `SELECT id, loggedAt, mediumTags, notes FROM entries ${pageFilter}
       ORDER BY loggedAt DESC, id DESC LIMIT ?`,
      [...pageParams, opts.limit],
    ),
    db.get<{ total: number }>(
      `SELECT COUNT(*) AS total FROM entries ${filter}`,
      params,
    ),
  ]);
  return { entries: await withDetails(rows), total: count?.total ?? 0 };
}

// Adds persons (with their groups) and thoughts to entry rows.
async function withDetails(
  rows: {
    id: number;
    loggedAt: string;
    mediumTags: string;
    notes: string | null;
  }[],
): Promise<Entry[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(",");
  const [links, thoughts] = await Promise.all([
    db.all<NamedRow & { entryId: number }>(
      `SELECT ep.entryId, p.id, p.name, p.photo
       FROM entryPersons ep JOIN persons p ON p.id = ep.personId
       WHERE ep.entryId IN (${marks})`,
      ids,
    ),
    db.all<{ id: number; entryId: number; tag: string; personIds: string }>(
      `SELECT id, entryId, tag, personIds FROM entryThoughts
       WHERE entryId IN (${marks}) ORDER BY id`,
      ids,
    ),
  ]);
  const groups = await groupsByPerson([...new Set(links.map((l) => l.id))]);

  return rows.map((r) => ({
    id: r.id,
    loggedAt: r.loggedAt,
    mediumTags: JSON.parse(r.mediumTags),
    notes: r.notes,
    persons: links
      .filter((l) => l.entryId === r.id)
      .map((l) => ({ ...summary(l), groups: groups.get(l.id) ?? [] })),
    thoughts: thoughts
      .filter((t) => t.entryId === r.id)
      .map((t) => ({
        id: t.id,
        tag: t.tag,
        personIds: JSON.parse(t.personIds),
      })),
  }));
}
