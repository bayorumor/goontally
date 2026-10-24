import Link from "next/link";
import { requireUserId } from "@/lib/api";
import { getStats, Stats } from "@/lib/stats";
import { getViewerTimeZone } from "@/lib/viewer";
import { localDateParts } from "@/lib/timezone";
import { titleCase } from "@/lib/format";
import { Person } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import PersonCard from "@/components/PersonCard";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import PersonGrid, { CARD_GRID } from "@/components/PersonGrid";
import AvatarCluster from "@/components/ui/AvatarCluster";
import Stat from "@/components/ui/Stat";
import { EmptyState, PageHeader } from "@/components/StateViews";
import LogButton from "@/components/log/LogButton";

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function HourChart({ data }: { data: Stats["timeOfDay"] }) {
  const max = Math.max(1, ...data.map((h) => h.count));
  return (
    <div className="flex h-full flex-col">
      {/* Bar heights are percentages, so this box needs a definite height:
          fixed when stacked on phones, stretched to the heatmap beside it on
          wider screens. */}
      <div className="flex h-28 items-end gap-[3px] md:h-auto md:flex-1">
        {data.map((h) => (
          <div
            key={h.hour}
            title={`${String(h.hour).padStart(2, "0")}:00 · ${h.count}`}
            // The busiest hour gets the warm accent.
            className={`flex-1 rounded-t-[3px] ${h.count === max ? "bg-warm" : "bg-primary"}`}
            style={{
              height: `${Math.max(4, (h.count / max) * 100)}%`,
              opacity: h.count ? 1 : 0.15,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

function BarList({
  items,
}: {
  items: { label: React.ReactNode; key: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-[14px]">
            {item.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className={`block h-full rounded-full ${i === 0 ? "bg-warm" : "bg-primary"}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-muted">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

// "Alex", "Alex & Sam", "Alex, Sam & Robin"
const joinNames = (names: string[]) =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

// Top pairings: five columns on wider screens, a list on phones (five
// items would leave a lone pair in a three-column grid).
function PairingGrid({ items }: { items: Stats["topPairings"] }) {
  const names = (item: Stats["topPairings"][number]) =>
    joinNames(item.persons.map((p) => titleCase(p.name)));
  const meta = (item: Stats["topPairings"][number], i: number) => (
    <>
      <span
        className={`font-semibold ${i === 0 ? "text-warm" : "text-subtle"}`}
      >
        #{i + 1}
      </span>{" "}
      · {item.count} log{item.count !== 1 ? "s" : ""}
    </>
  );
  const key = (item: Stats["topPairings"][number]) =>
    item.persons.map((p) => p.id).join("-");

  return (
    <>
      <ol className="hidden grid-cols-5 gap-4 md:grid">
        {items.map((item, i) => (
          <li
            key={key(item)}
            className="flex flex-col items-center gap-2 text-center"
          >
            <AvatarCluster persons={item.persons} size={72} />
            <div>
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug">
                {names(item)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">{meta(item, i)}</p>
            </div>
          </li>
        ))}
      </ol>

      <ol className="flex flex-col divide-y divide-border md:hidden">
        {items.map((item, i) => (
          <li
            key={key(item)}
            className="flex items-center gap-4 py-2 first:pt-0 last:pb-0"
          >
            <AvatarCluster persons={item.persons} size={36} />
            <div className="min-w-0">
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug">
                {names(item)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">{meta(item, i)}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-4 p-4">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

function Highlight({
  person,
  label,
  detail,
}: {
  person: Person;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <PersonCard person={person} showCount={false} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">
          {label}
        </p>
        <p className="text-[13px] text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  const userId = await requireUserId();
  const timeZone = await getViewerTimeZone();
  const stats = await getStats(userId, timeZone);

  if (!stats)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Insights" />
        <EmptyState
          title="Your stats start here"
          sub="Log a few entries and patterns show up on this page."
          action={<LogButton label="Log entry" />}
        />
      </div>
    );

  const today = localDateParts(new Date(), timeZone).date;
  const monthAgo = isoDay(Date.parse(today) - 29 * DAY_MS);
  const last30 = stats.heatmapData
    .filter((d) => d.date >= monthAgo)
    .reduce((sum, d) => sum + d.count, 0);

  const plural = (n: number, word: string) =>
    `${n} ${word}${n !== 1 ? "s" : ""}`;
  // Each highlight only shows when its stat found someone.
  const highlights = [
    stats.mostLoyal && {
      person: stats.mostLoyal.person,
      label: "Most downbad",
      detail: plural(stats.mostLoyal.months, "different month"),
    },
    stats.hyperfixation && {
      person: stats.hyperfixation.person,
      label: "Hyperfixation",
      detail: `+${stats.hyperfixation.increase} vs last month`,
    },
    stats.comeback && {
      person: stats.comeback.person,
      label: "Comeback",
      detail: `Back after ${stats.comeback.days} days`,
    },
    stats.longestStreak && {
      person: stats.longestStreak.person,
      label: "Longest streak",
      detail: `${stats.longestStreak.days} days in a row`,
    },
    stats.forgottenFavorite && {
      person: stats.forgottenFavorite.person,
      label: "Forgotten favorite",
      detail: `Last logged ${stats.forgottenFavorite.days} days ago`,
    },
    stats.mostVariety && {
      person: stats.mostVariety.person,
      label: "Most variety",
      detail: `${stats.mostVariety.count} different finish${stats.mostVariety.count !== 1 ? "es" : ""}`,
    },
  ].filter((h) => !!h);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Insights" />

      <div className="grid grid-cols-3 gap-2">
        <Stat value={stats.totalEntries} label="Total goons" />
        <Stat value={last30} label="Last 30 days" />
        <Stat value={stats.totalPersons} label="Persons" />
      </div>

      {/* Two equal halves on wider screens; the heatmap fits as many weeks
          as its half allows and the hour chart stretches to the same height. */}
      <section className="card grid grid-cols-1 gap-6 p-4 md:grid-cols-2 md:gap-8">
        <ActivityHeatmap data={stats.heatmapData} today={today} />
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="section-label">Time of day</h2>
          <div className="flex-1">
            <HourChart data={stats.timeOfDay} />
          </div>
        </div>
      </section>

      {highlights.length > 0 && (
        <Panel title="Highlights">
          <div className={CARD_GRID}>
            {highlights.map((h) => (
              <Highlight key={h.label} {...h} />
            ))}
          </div>
        </Panel>
      )}

      {stats.newThisMonth.length > 0 && (
        <Panel title={`New this month · ${stats.newThisMonth.length}`}>
          <PersonGrid persons={stats.newThisMonth} showCount={false} />
        </Panel>
      )}

      {/* grid-cols-1 caps the single phone column at the screen width;
          an implicit column would grow to fit the widest content. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stats.topPersons.length > 0 && (
          <Panel title="Top persons">
            <BarList
              items={stats.topPersons.map((t) => ({
                key: String(t.person.id),
                count: t.count,
                label: (
                  <Link
                    href={`/persons/${t.person.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar
                      src={t.person.photoUrl}
                      name={t.person.name}
                      size={22}
                    />
                    <span className="truncate">{titleCase(t.person.name)}</span>
                  </Link>
                ),
              }))}
            />
          </Panel>
        )}

        {stats.topGroups.length > 0 && (
          <Panel title="Top groups">
            <ol className="flex flex-col gap-2">
              {stats.topGroups.map((g, i) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center gap-3 rounded-md p-1.5 transition hover:bg-surface-2"
                  >
                    <span
                      className={`w-5 text-center font-display text-[13px] font-bold ${i === 0 ? "text-warm" : "text-subtle"}`}
                    >
                      {i + 1}
                    </span>
                    <Avatar
                      src={g.photoUrl}
                      name={g.name}
                      size={44}
                      shape="rounded"
                    />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                      {titleCase(g.name)}
                    </span>
                    <span className="text-[13px] tabular-nums text-muted">
                      {g.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>

      <Panel title="Top pairing">
        {stats.topPairings.length > 0 ? (
          <PairingGrid items={stats.topPairings} />
        ) : (
          <p className="text-[14px] text-muted">
            Log an entry with two or more persons to see who you pair most.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stats.mediumBreakdown.length > 0 && (
          <Panel title="By medium">
            <BarList
              items={stats.mediumBreakdown
                .slice(0, 5)
                .map((m) => ({ key: m.tag, label: m.tag, count: m.count }))}
            />
          </Panel>
        )}

        {stats.thoughtBreakdown.length > 0 && (
          <Panel title="Top finish">
            <BarList
              items={stats.thoughtBreakdown
                .slice(0, 5)
                .map((t) => ({ key: t.tag, label: t.tag, count: t.count }))}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
