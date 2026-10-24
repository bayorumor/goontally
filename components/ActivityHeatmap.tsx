"use client";

import { useEffect, useRef, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
// Cells aim for about this size; the column count adapts to the width and
// the cells then stretch a little so the grid fills it exactly.
const TARGET_CELL = 16;
const GAP = 3;
const MIN_WEEKS = 8;
const MAX_WEEKS = 53;
// Used for the server render, before the width is known.
const DEFAULT_WEEKS = 26;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface Props {
  data: { date: string; count: number }[];
  // "YYYY-MM-DD" for today in the viewer's timezone.
  today: string;
}

// GitHub-style activity grid: one column per week (Mon–Sun), as many recent
// weeks as fit the available width.
export default function ActivityHeatmap({ data, today }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const n = Math.floor((el.clientWidth + GAP) / (TARGET_CELL + GAP));
      setWeeks(Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, n)));
    };
    // The observer also fires once right away with the current width.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const counts = new Map(data.map((d) => [d.date, d.count]));
  const todayMs = Date.parse(today);
  const weekday = (new Date(todayMs).getUTCDay() + 6) % 7; // Monday = 0
  const start = todayMs - (weekday + (weeks - 1) * 7) * DAY_MS;
  const max = Math.max(1, ...data.map((x) => x.count));

  const shade = (count: number) => {
    // Empty days use the lighter surface so the grid reads on the grainy card.
    if (!count) return "var(--surface-3)";
    const pct = Math.round(30 + (count / max) * 70);
    return `color-mix(in srgb, var(--primary) ${pct}%, var(--surface-2))`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="section-label">Activity · last {weeks} weeks</h2>
      <div
        ref={ref}
        className="grid grid-flow-col"
        style={{
          gap: GAP,
          gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
          gridTemplateRows: "repeat(7, auto)",
        }}
      >
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const ms = start + i * DAY_MS;
          const date = isoDay(ms);
          const count = counts.get(date) ?? 0;
          const future = ms > todayMs;
          return (
            <div
              key={date}
              title={
                future
                  ? undefined
                  : `${date}: ${count} entr${count === 1 ? "y" : "ies"}`
              }
              className="aspect-square rounded-[3px]"
              style={{ background: future ? "transparent" : shade(count) }}
            />
          );
        })}
      </div>
    </div>
  );
}
