import { localDateParts } from "./timezone";
import type { Group, Person } from "./types";

// The Insights numbers, worked out in plain JavaScript from the raw rows.
// The Android app uses this on its SQLite data; the web app gets the same
// numbers from Postgres in lib/stats.ts. Both must agree, so every rule and
// tie-break here mirrors a query there.

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

export interface StatsInput {
  entries: {
    id: number;
    loggedAt: string;
    mediumTags: string[];
    personIds: number[];
    thoughts: { tag: string; personIds: number[] }[];
  }[];
  persons: Person[];
  groups: Group[];
  memberships: { personId: number; groupId: number }[];
}

// The heatmap shows as many weeks as fit its width, up to a year.
export const HEATMAP_DAYS = 371;
// Shorter gaps than this aren't much of a comeback.
export const MIN_COMEBACK_DAYS = 14;
// A favorite counts as forgotten after this long without a log.
export const MIN_FORGOTTEN_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;
// 10 rows of Top persons line up with the 5 Top groups rows beside it.
export const TOP_PERSONS = 10;

// Ties on a label sort the way the web app's database does (en_US).
const byLabel = new Intl.Collator("en-US").compare;

// Most first, then by `tie`.
function ranked<T>(
  rows: T[],
  count: (r: T) => number,
  tie: (a: T, b: T) => number,
) {
  return rows.sort((a, b) => count(b) - count(a) || tie(a, b));
}

function tally<K>(keys: K[]) {
  const counts = new Map<K, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

export function computeStats(
  input: StatsInput,
  timeZone: string,
  now = new Date(),
): Stats | null {
  const { entries } = input;
  if (!entries.length) return null;

  // Local date, month and hour of each entry, as seen in the timezone.
  const hourFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const local = entries.map((e) => {
    const at = new Date(e.loggedAt);
    return {
      ...e,
      at: at.getTime(),
      ...localDateParts(at, timeZone),
      hour: Number(hourFormat.format(at)),
    };
  });
  const thisMonth = localDateParts(now, timeZone).month;

  // Each person's entries, oldest first.
  const byPerson = new Map<number, typeof local>();
  for (const e of local)
    for (const id of e.personIds) {
      const list = byPerson.get(id) ?? [];
      list.push(e);
      byPerson.set(id, list);
    }
  for (const list of byPerson.values()) list.sort((a, b) => a.at - b.at);
  const personIds = [...byPerson.keys()].sort((a, b) => a - b);

  const personCounts = ranked(
    personIds.map((id) => {
      const list = byPerson.get(id)!;
      return { id, count: list.length, last: list[list.length - 1].at };
    }),
    (p) => p.count,
    (a, b) => a.id - b.id,
  );

  const breakdown = (tags: string[]) =>
    ranked(
      [...tally(tags)].map(([tag, count]) => ({ tag, count })),
      (t) => t.count,
      (a, b) => byLabel(a.tag, b.tag),
    );
  const thoughtBreakdown = breakdown(
    local.flatMap((e) => e.thoughts.map((t) => t.tag)),
  );
  const mediumBreakdown = breakdown(local.flatMap((e) => e.mediumTags));

  const since = now.getTime() - HEATMAP_DAYS * DAY_MS;
  const heatmapData = [
    ...tally(local.filter((e) => e.at > since).map((e) => e.date)),
  ]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const hourCount = Array(24).fill(0) as number[];
  for (const e of local) hourCount[e.hour]++;

  // Entries with any member of the group, each counted once.
  const membersOf = new Map<number, Set<number>>();
  for (const m of input.memberships) {
    const set = membersOf.get(m.groupId) ?? new Set();
    set.add(m.personId);
    membersOf.set(m.groupId, set);
  }
  const topGroups = ranked(
    input.groups.flatMap((g) => {
      const members = membersOf.get(g.id);
      const count = members
        ? local.filter((e) => e.personIds.some((id) => members.has(id))).length
        : 0;
      return count ? [{ ...g, count }] : [];
    }),
    (g) => g.count,
    (a, b) => a.id - b.id,
  ).slice(0, 5);

  // Each entry with 2+ persons is keyed by its sorted person ids.
  const combos = tally(
    local
      .filter((e) => e.personIds.length >= 2)
      .map((e) => [...e.personIds].sort((a, b) => a - b).join(",")),
  );
  const pairings = ranked(
    [...combos].map(([key, count]) => ({
      ids: key.split(",").map(Number),
      count,
    })),
    (p) => p.count,
    // Postgres compares arrays element by element, then by length.
    (a, b) => {
      for (let i = 0; i < Math.min(a.ids.length, b.ids.length); i++)
        if (a.ids[i] !== b.ids[i]) return a.ids[i] - b.ids[i];
      return a.ids.length - b.ids.length;
    },
  ).slice(0, 5);

  // Widest gap before one of a person's entries that landed this month.
  let comeback: { id: number; days: number } | null = null;
  for (const id of personIds) {
    const list = byPerson.get(id)!;
    let widest = -1;
    for (let i = 1; i < list.length; i++)
      if (list[i].month === thisMonth)
        widest = Math.max(widest, list[i].at - list[i - 1].at);
    if (widest < 0) continue;
    const days = Math.floor(widest / DAY_MS);
    if (!comeback || days > comeback.days) comeback = { id, days };
  }
  if (comeback && comeback.days < MIN_COMEBACK_DAYS) comeback = null;

  // Runs of consecutive local days; longest wins, then the most recent run.
  let streak: { id: number; days: number; end: number } | null = null;
  for (const id of personIds) {
    const days = [
      ...new Set(byPerson.get(id)!.map((e) => Date.parse(e.date) / DAY_MS)),
    ].sort((a, b) => a - b);
    let start = 0;
    for (let i = 1; i <= days.length; i++) {
      if (i < days.length && days[i] === days[i - 1] + 1) continue;
      const run = { id, days: i - start, end: days[i - 1] };
      if (
        !streak ||
        run.days > streak.days ||
        (run.days === streak.days && run.end > streak.end)
      )
        streak = run;
      start = i;
    }
  }
  const longest = streak && streak.days >= 2 ? streak : null;

  // Different finishes credited to each person a thought was about.
  const tagsFor = new Map<number, Set<string>>();
  for (const e of local)
    for (const t of e.thoughts)
      for (const id of t.personIds) {
        const set = tagsFor.get(id) ?? new Set();
        set.add(t.tag);
        tagsFor.set(id, set);
      }
  const varietyRow = ranked(
    [...tagsFor].map(([id, tags]) => ({ id, count: tags.size })),
    (v) => v.count,
    (a, b) => a.id - b.id,
  )[0];
  const variety = varietyRow && varietyRow.count >= 2 ? varietyRow : null;

  // Of the all-time top 10, the one gone quiet the longest.
  const forgotten = personCounts
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      days: Math.floor((now.getTime() - p.last) / DAY_MS),
    }))
    .filter((p) => p.days >= MIN_FORGOTTEN_DAYS)
    .sort((a, b) => b.days - a.days)[0];

  const [year, month] = thisMonth.split("-").map(Number);
  const lastMonth =
    month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, "0")}`;

  let loyal: { id: number; months: number } | null = null;
  let hyper: { id: number; count: number; increase: number } | null = null;
  const newIds: number[] = [];
  for (const id of personIds) {
    const months = tally(byPerson.get(id)!.map((e) => e.month));
    if (!loyal || months.size > loyal.months)
      loyal = { id, months: months.size };

    const count = months.get(thisMonth) ?? 0;
    const increase = count - (months.get(lastMonth) ?? 0);
    if (count && increase > (hyper?.increase ?? 0))
      hyper = { id, count, increase };

    if ([...months.keys()].sort()[0] === thisMonth) newIds.push(id);
  }

  const personById = new Map(input.persons.map((p) => [p.id, p]));
  const find = <T extends { id: number }, R>(
    row: T | null | undefined,
    make: (p: Person, r: T) => R,
  ) => {
    const person = row && personById.get(row.id);
    return person ? make(person, row) : null;
  };

  return {
    totalEntries: entries.length,
    totalPersons: personCounts.length,
    topPersons: personCounts.slice(0, TOP_PERSONS).flatMap((p) => {
      const person = personById.get(p.id);
      return person ? [{ person, count: p.count }] : [];
    }),
    thoughtBreakdown,
    mediumBreakdown,
    heatmapData,
    timeOfDay: hourCount.map((count, hour) => ({ hour, count })),
    mostLoyal: find(loyal, (person, r) => ({ person, months: r.months })),
    hyperfixation: find(hyper, (person, r) => ({
      person,
      count: r.count,
      increase: r.increase,
    })),
    comeback: find(comeback, (person, r) => ({ person, days: r.days })),
    forgottenFavorite: find(forgotten, (person, r) => ({
      person,
      days: r.days,
    })),
    mostVariety: find(variety, (person, r) => ({ person, count: r.count })),
    longestStreak: find(longest, (person, r) => ({ person, days: r.days })),
    topGroups: topGroups.map(({ id, name, photoUrl, count }) => ({
      id,
      name,
      photoUrl,
      count,
    })),
    newThisMonth: newIds.flatMap((id) => personById.get(id) ?? []),
    topPairings: pairings.map((p) => ({
      persons: p.ids.flatMap((id) => personById.get(id) ?? []),
      count: p.count,
    })),
  };
}
