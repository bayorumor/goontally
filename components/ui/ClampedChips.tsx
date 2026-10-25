"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface ChipItem {
  key: string;
  label: string;
  className?: string;
}

// A wrapping row of chips that stops at `rows` lines: what doesn't fit is
// counted in a closing "+N" chip. How many fit depends on the chips' widths
// and the row's, so it's measured, and measured again when the width
// changes.
export default function ClampedChips({
  items,
  rows = 2,
  chipClassName = "",
}: {
  items: ChipItem[];
  rows?: number;
  // Added to every chip, the "+N" one included.
  chipClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(items.length);
  // The items' identity, so a new array with the same chips changes nothing.
  const signature = items.map((i) => i.key).join("\u0000");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Start over with every chip whenever the chips or the width change.
  const measuring = `${signature}\u0001${width}`;
  const [measured, setMeasured] = useState(measuring);
  if (measured !== measuring) {
    setMeasured(measuring);
    setShown(items.length);
  }

  // Then drop chips until everything, "+N" included, fits in `rows` lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown === 0) return;
    const chips = [...el.children] as HTMLElement[];
    const lines = [...new Set(chips.map((c) => c.offsetTop))].sort(
      (a, b) => a - b,
    );
    if (lines.length <= rows) return;
    if (shown === items.length) {
      // First pass: keep what's on the allowed lines, less one for "+N".
      const last = lines[rows - 1];
      const fit = chips.filter((c) => c.offsetTop <= last).length;
      setShown(Math.max(0, fit - 1));
    } else setShown(shown - 1);
  }, [shown, signature, width, rows, items.length]);

  const hidden = items.length - shown;

  return (
    <div ref={ref} className="chip-row">
      {items.slice(0, shown).map((item) => (
        <span
          key={item.key}
          className={`chip ${item.className ?? ""} ${chipClassName}`}
        >
          {item.label}
        </span>
      ))}
      {hidden > 0 && (
        <span
          className={`chip ${chipClassName}`}
          aria-label={`${hidden} more`}
          title={items
            .slice(shown)
            .map((i) => i.label)
            .join(", ")}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
