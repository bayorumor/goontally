import "server-only";
import { prisma } from "./prisma";
import { localDateParts } from "./timezone";
import { Person } from "./types";

export interface Stats {
  totalEntries: number;
  totalPersons: number;
  topPersons: { person: Person; count: number }[];
  thoughtBreakdown: { tag: string; count: number }[];
  mediumBreakdown: { tag: string; count: number }[];
  heatmapData: { date: string; count: number }[];
  timeOfDay: { hour: number; count: number }[];
  mostLoyal: { person: Person; months: number } | null;
  hyperfixation: { person: Person; count: number; increase: number } | null;
  // Logged this month after the longest gap since their previous entry.
  comeback: { person: Person; days: number } | null;
  // Most consecutive local days with at least one entry, all time.
  longestStreak: { person: Person; days: number } | null;
  // A former top-10 person who hasn't been logged in the longest time.
  forgottenFavorite: { person: Person; days: number } | null;
  // Most different finishes (thought tags) aimed at one person.
  mostVariety: { person: Person; count: number } | null;
  topGroups: {
    id: number;
    name: string;
    photoUrl: string | null;
    count: number;
  }[];
  newThisMonth: Person[];
  // Exact sets of 2+ persons logged together, most entries first.
  topPairings: { persons: Person[]; count: number }[];
}

// The heatmap shows as many weeks as fit its width, up to a year.
const HEATMAP_DAYS = 371;
// Shorter gaps than this aren't much of a comeback.
const MIN_COMEBACK_DAYS = 14;
// A favorite counts as forgotten after this long without a log.
const MIN_FORGOTTEN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// 10 rows of Top persons line up with the 5 Top groups rows beside it.
const TOP_PERSONS = 10;

// All aggregation happens in Postgres. Entry.loggedAt is stored as UTC, so
// day/month/hour buckets convert it to the viewer's timezone first.
export async function getStats(
  userId: number,
  tz: string,
): Promise<Stats | null> {
  const local = (alias: string) =>
    `((${alias}."loggedAt" AT TIME ZONE 'UTC') AT TIME ZONE $2)`;
  const thisMonth = localDateParts(new Date(), tz).month;

  const [
    [{ total }],
    personCounts,
    thoughtBreakdown,
    mediumBreakdown,
    heatmapData,
    hours,
    personMonths,
    topGroups,
    pairings,
    [comebackRow],
    [streakRow],
    [varietyRow],
  ] = await Promise.all([
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM "Entry" WHERE "userId" = ${userId}`,
    prisma.$queryRaw<{ id: number; count: number; last: Date }[]>`
      SELECT ep."personId" AS id, COUNT(*)::int AS count,
             MAX(e."loggedAt") AS last
      FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
      WHERE e."userId" = ${userId}
      GROUP BY ep."personId"
      ORDER BY count DESC, id ASC`,
    prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT t.tag, COUNT(*)::int AS count
      FROM "EntryThought" t JOIN "Entry" e ON e.id = t."entryId"
      WHERE e."userId" = ${userId}
      GROUP BY t.tag
      ORDER BY count DESC, t.tag ASC`,
    prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT m AS tag, COUNT(*)::int AS count
      FROM "Entry" e, unnest(e."mediumTags") AS m
      WHERE e."userId" = ${userId}
      GROUP BY m
      ORDER BY count DESC, m ASC`,
    prisma.$queryRawUnsafe<{ date: string; count: number }[]>(
      `SELECT to_char(${local("e")}, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
       FROM "Entry" e
       WHERE e."userId" = $1 AND e."loggedAt" > now() - interval '${HEATMAP_DAYS} days'
       GROUP BY 1 ORDER BY 1`,
      userId,
      tz,
    ),
    prisma.$queryRawUnsafe<{ hour: number; count: number }[]>(
      `SELECT EXTRACT(HOUR FROM ${local("e")})::int AS hour, COUNT(*)::int AS count
       FROM "Entry" e WHERE e."userId" = $1
       GROUP BY 1`,
      userId,
      tz,
    ),
    prisma.$queryRawUnsafe<{ id: number; month: string; count: number }[]>(
      `SELECT ep."personId" AS id, to_char(${local("e")}, 'YYYY-MM') AS month,
              COUNT(*)::int AS count
       FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
       WHERE e."userId" = $1
       GROUP BY 1, 2 ORDER BY 1, 2`,
      userId,
      tz,
    ),
    // Entries with any member of the group, each counted once.
    prisma.$queryRaw<
      { id: number; name: string; photoUrl: string | null; count: number }[]
    >`
      SELECT g.id, g.name, g."photoUrl", COUNT(DISTINCT e.id)::int AS count
      FROM "EntryPerson" ep
      JOIN "Entry" e ON e.id = ep."entryId"
      JOIN "PersonGroup" pg ON pg."personId" = ep."personId"
      JOIN "Group" g ON g.id = pg."groupId"
      WHERE e."userId" = ${userId}
      GROUP BY g.id
      ORDER BY count DESC, g.id ASC
      LIMIT 5`,
    // Each entry with 2+ persons is keyed by its sorted person ids, so the
    // same combination always groups together whatever order it was logged in.
    prisma.$queryRaw<{ ids: number[]; count: number }[]>`
      SELECT ids, COUNT(*)::int AS count
      FROM (
        SELECT array_agg(ep."personId" ORDER BY ep."personId") AS ids
        FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
        WHERE e."userId" = ${userId}
        GROUP BY ep."entryId"
        HAVING COUNT(*) >= 2
      ) combos
      GROUP BY ids
      ORDER BY count DESC, ids ASC
      LIMIT 5`,
    // Gap before each of a person's entries; keep the widest one that ended
    // with an entry this month.
    prisma.$queryRawUnsafe<{ id: number; days: number }[]>(
      `WITH spans AS (
         SELECT ep."personId" AS id, e."loggedAt" AS at,
                LAG(e."loggedAt") OVER (
                  PARTITION BY ep."personId" ORDER BY e."loggedAt"
                ) AS prev
         FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
         WHERE e."userId" = $1
       )
       SELECT id, FLOOR(MAX(EXTRACT(EPOCH FROM (at - prev))) / 86400)::int AS days
       FROM spans
       WHERE prev IS NOT NULL
         AND to_char((at AT TIME ZONE 'UTC') AT TIME ZONE $2, 'YYYY-MM') = $3
       GROUP BY id
       ORDER BY days DESC, id ASC
       LIMIT 1`,
      userId,
      tz,
      thisMonth,
    ),
    // Gaps-and-islands: consecutive local days share the same (day - rank).
    prisma.$queryRawUnsafe<{ id: number; days: number }[]>(
      `WITH days AS (
         SELECT DISTINCT ep."personId" AS id, (${local("e")})::date AS d
         FROM "EntryPerson" ep JOIN "Entry" e ON e.id = ep."entryId"
         WHERE e."userId" = $1
       ), runs AS (
         SELECT id, d, d - (ROW_NUMBER() OVER (PARTITION BY id ORDER BY d))::int AS run
         FROM days
       )
       SELECT id, COUNT(*)::int AS days
       FROM runs
       GROUP BY id, run
       ORDER BY days DESC, MAX(d) DESC, id ASC
       LIMIT 1`,
      userId,
      tz,
    ),
    // A thought lists the persons it was about, so unnest them to credit
    // each tag to the right person in multi-person entries.
    prisma.$queryRaw<{ id: number; count: number }[]>`
      SELECT pid AS id, COUNT(DISTINCT t.tag)::int AS count
      FROM "EntryThought" t
      JOIN "Entry" e ON e.id = t."entryId"
      CROSS JOIN LATERAL unnest(t."personIds") AS pid
      WHERE e."userId" = ${userId}
      GROUP BY pid
      ORDER BY count DESC, pid ASC
      LIMIT 1`,
  ]);

  const variety = varietyRow && varietyRow.count >= 2 ? varietyRow : null;

  // Of the all-time top 10, the one gone quiet the longest.
  const forgotten = personCounts
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      days: Math.floor((Date.now() - new Date(p.last).getTime()) / DAY_MS),
    }))
    .filter((p) => p.days >= MIN_FORGOTTEN_DAYS)
    .sort((a, b) => b.days - a.days)[0];

  const comeback =
    comebackRow && comebackRow.days >= MIN_COMEBACK_DAYS ? comebackRow : null;
  const streak = streakRow && streakRow.days >= 2 ? streakRow : null;

  if (!total) return null;

  const [year, month] = thisMonth.split("-").map(Number);
  const lastMonth =
    month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, "0")}`;

  // Per-person month buckets drive the "loyal", "hyperfixation" and
  // "new this month" highlights. Rows arrive ordered by person then month.
  const byPerson = new Map<number, { month: string; count: number }[]>();
  for (const row of personMonths) {
    if (!byPerson.has(row.id)) byPerson.set(row.id, []);
    byPerson.get(row.id)!.push(row);
  }

  let loyal: { id: number; months: number } | null = null;
  let hyper: { id: number; count: number; increase: number } | null = null;
  const newIds: number[] = [];
  for (const [id, months] of byPerson) {
    if (!loyal || months.length > loyal.months)
      loyal = { id, months: months.length };

    const count = months.find((m) => m.month === thisMonth)?.count ?? 0;
    const previous = months.find((m) => m.month === lastMonth)?.count ?? 0;
    const increase = count - previous;
    if (count && increase > (hyper?.increase ?? 0))
      hyper = { id, count, increase };

    if (months[0].month === thisMonth) newIds.push(id);
  }

  const topIds = personCounts.slice(0, TOP_PERSONS).map((p) => p.id);
  const neededIds = [
    ...new Set([
      ...topIds,
      ...newIds,
      ...(loyal ? [loyal.id] : []),
      ...(hyper ? [hyper.id] : []),
      ...pairings.flatMap((p) => p.ids),
      ...(comeback ? [comeback.id] : []),
      ...(streak ? [streak.id] : []),
      ...(forgotten ? [forgotten.id] : []),
      ...(variety ? [variety.id] : []),
    ]),
  ];
  const persons = await prisma.person.findMany({
    where: { id: { in: neededIds }, userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
    },
  });
  const personById = new Map<number, Person>(
    persons.map((p) => [p.id, { ...p, groups: p.groups.map((g) => g.group) }]),
  );

  const hourCount = Array(24).fill(0) as number[];
  for (const h of hours) hourCount[h.hour] = h.count;

  return {
    totalEntries: total,
    totalPersons: personCounts.length,
    topPersons: personCounts.slice(0, TOP_PERSONS).flatMap((p) => {
      const person = personById.get(p.id);
      return person ? [{ person, count: p.count }] : [];
    }),
    thoughtBreakdown,
    mediumBreakdown,
    heatmapData,
    timeOfDay: hourCount.map((count, hour) => ({ hour, count })),
    mostLoyal:
      loyal && personById.has(loyal.id)
        ? { person: personById.get(loyal.id)!, months: loyal.months }
        : null,
    hyperfixation:
      hyper && personById.has(hyper.id)
        ? {
            person: personById.get(hyper.id)!,
            count: hyper.count,
            increase: hyper.increase,
          }
        : null,
    comeback:
      comeback && personById.has(comeback.id)
        ? { person: personById.get(comeback.id)!, days: comeback.days }
        : null,
    forgottenFavorite:
      forgotten && personById.has(forgotten.id)
        ? { person: personById.get(forgotten.id)!, days: forgotten.days }
        : null,
    mostVariety:
      variety && personById.has(variety.id)
        ? { person: personById.get(variety.id)!, count: variety.count }
        : null,
    longestStreak:
      streak && personById.has(streak.id)
        ? { person: personById.get(streak.id)!, days: streak.days }
        : null,
    topGroups,
    newThisMonth: newIds.flatMap((id) => personById.get(id) ?? []),
    topPairings: pairings.map((p) => ({
      persons: p.ids.flatMap((id) => personById.get(id) ?? []),
      count: p.count,
    })),
  };
}
