import "server-only";
import { prisma } from "./prisma";
import {
  Entry,
  Group,
  GroupStats,
  GroupWithMembers,
  Person,
  PersonWithCount,
} from "./types";

// Read queries shared by server-rendered pages and API routes. Every query
// is scoped to the given user.

const groupRefs = {
  groups: { select: { group: { select: { id: true, name: true } } } },
} as const;

const flattenGroups = (groups: { group: { id: number; name: string } }[]) =>
  groups.map((g) => g.group);

export async function listPersons(
  userId: number,
  sort: "name" | "lastLogged",
): Promise<PersonWithCount[]> {
  if (sort === "lastLogged") {
    // Only persons that have been logged, most recent first.
    const rows = await prisma.$queryRaw<
      {
        id: number;
        name: string;
        photoUrl: string | null;
        entryCount: number;
      }[]
    >`
      SELECT p.id, p.name, p."photoUrl", COUNT(ep."entryId")::int AS "entryCount"
      FROM "Person" p
      JOIN "EntryPerson" ep ON ep."personId" = p.id
      JOIN "Entry" e ON e.id = ep."entryId"
      WHERE p."userId" = ${userId}
      GROUP BY p.id
      ORDER BY MAX(e."loggedAt") DESC
    `;
    const links = await prisma.personGroup.findMany({
      where: { personId: { in: rows.map((r) => r.id) } },
      select: { personId: true, group: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      ...r,
      groups: links.filter((l) => l.personId === r.id).map((l) => l.group),
    }));
  }

  const persons = await prisma.person.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      ...groupRefs,
      _count: { select: { entries: true } },
    },
    orderBy: { name: "asc" },
  });
  return persons.map((p) => ({
    id: p.id,
    name: p.name,
    photoUrl: p.photoUrl,
    groups: flattenGroups(p.groups),
    entryCount: p._count.entries,
  }));
}

// Every person with their groups, for the log/add pickers.
export async function listPersonsWithGroups(userId: number): Promise<Person[]> {
  const persons = await prisma.person.findMany({
    where: { userId },
    select: { id: true, name: true, photoUrl: true, ...groupRefs },
    orderBy: { name: "asc" },
  });
  return persons.map((p) => ({ ...p, groups: flattenGroups(p.groups) }));
}

// Persons for the quick-log picker: most recently logged first, then the
// never-logged ones by name.
export async function listPersonsForPicker(userId: number): Promise<Person[]> {
  const [persons, recent] = await Promise.all([
    listPersonsWithGroups(userId),
    prisma.$queryRaw<{ id: number }[]>`
      SELECT ep."personId" AS id
      FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
      WHERE e."userId" = ${userId}
      GROUP BY ep."personId"
      ORDER BY MAX(e."loggedAt") DESC
    `,
  ]);
  const rank = new Map(recent.map((r, i) => [r.id, i]));
  return persons.sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );
}

export async function listGroups(userId: number): Promise<GroupWithMembers[]> {
  const groups = await prisma.group.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      persons: {
        select: {
          person: { select: { id: true, name: true, photoUrl: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => ({ ...g, persons: g.persons.map((p) => p.person) }));
}

export async function listGroupRefs(userId: number): Promise<Group[]> {
  return prisma.group.findMany({
    where: { userId },
    select: { id: true, name: true, photoUrl: true },
    orderBy: { name: "asc" },
  });
}

export async function getGroupDetail(
  userId: number,
  groupId: number,
): Promise<{ group: GroupWithMembers; stats: GroupStats } | null> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      persons: {
        select: {
          person: { select: { id: true, name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!group) return null;

  const members = group.persons.map((p) => p.person);
  const memberIds = members.map((m) => m.id);
  const [entryCounts, totalEntries] = await Promise.all([
    prisma.entryPerson.groupBy({
      by: ["personId"],
      where: { personId: { in: memberIds } },
      _count: { personId: true },
      orderBy: { _count: { personId: "desc" } },
    }),
    // Entries with any member, each counted once even when several members
    // are in it.
    prisma.entry.count({
      where: { userId, persons: { some: { personId: { in: memberIds } } } },
    }),
  ]);

  const memberCounts: Record<number, number> = {};
  for (const e of entryCounts) memberCounts[e.personId] = e._count.personId;

  const top = entryCounts[0];
  const topMember = top && members.find((m) => m.id === top.personId);

  return {
    group: { ...group, persons: members },
    stats: {
      totalEntries,
      topPerson: topMember
        ? { ...topMember, entryCount: top._count.personId }
        : null,
      memberCounts,
    },
  };
}

export async function getPerson(
  userId: number,
  personId: number,
): Promise<Person | null> {
  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
    select: { id: true, name: true, photoUrl: true, ...groupRefs },
  });
  return person && { ...person, groups: flattenGroups(person.groups) };
}

// Newest first. Pages continue after the last entry already shown (`after`),
// so entries added or deleted meanwhile never shift what comes next.
export async function listEntries(
  userId: number,
  opts: {
    personId?: number;
    limit: number;
    after?: { loggedAt: Date; id: number };
  },
): Promise<{ entries: Entry[]; total: number }> {
  const where = {
    userId,
    ...(opts.personId
      ? { persons: { some: { personId: opts.personId } } }
      : {}),
  };
  const { after } = opts;
  const page = after
    ? {
        ...where,
        OR: [
          { loggedAt: { lt: after.loggedAt } },
          { loggedAt: after.loggedAt, id: { lt: after.id } },
        ],
      }
    : where;

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where: page,
      select: {
        id: true,
        loggedAt: true,
        mediumTags: true,
        notes: true,
        persons: {
          select: {
            person: {
              select: { id: true, name: true, photoUrl: true, ...groupRefs },
            },
          },
        },
        thoughts: { select: { id: true, tag: true, personIds: true } },
      },
      orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
      take: opts.limit,
    }),
    prisma.entry.count({ where }),
  ]);

  return {
    total,
    entries: entries.map((e) => ({
      ...e,
      loggedAt: e.loggedAt.toISOString(),
      persons: e.persons.map(({ person }) => ({
        ...person,
        groups: flattenGroups(person.groups),
      })),
    })),
  };
}

export async function getUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, avatar: true },
  });
}

export async function listOptionLabels(userId: number, category: string) {
  const options = await prisma.userCustomOption.findMany({
    where: { userId, category },
    select: { label: true },
    orderBy: { createdAt: "asc" },
  });
  return options.map((o) => o.label);
}
