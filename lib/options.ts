import { DEFAULT_MEDIUMS, DEFAULT_THOUGHTS } from "./constants";

// Finishes ("thought") and mediums offered when logging: the built-in ones
// minus any hidden, then the user's own, oldest first. Shared by the web
// app and the Android app so both list them the same way.

export type OptionCategory = "thought" | "medium";

export const DEFAULTS: Record<OptionCategory, string[]> = {
  thought: DEFAULT_THOUGHTS,
  medium: DEFAULT_MEDIUMS,
};

// A row of UserCustomOption (customOptions on the phone), oldest first.
export interface OptionRow {
  label: string;
  hidden: boolean;
}

export function visibleOptions(category: OptionCategory, rows: OptionRow[]) {
  const defaults = DEFAULTS[category];
  const hidden = new Set(rows.filter((r) => r.hidden).map((r) => r.label));
  return [
    ...defaults.filter((d) => !hidden.has(d)),
    ...rows
      .filter((r) => !r.hidden && !defaults.includes(r.label))
      .map((r) => r.label),
  ];
}

export const isDefault = (category: OptionCategory, label: string) =>
  DEFAULTS[category].includes(label);

// An option as the "Log options" sheet shows it: how many entries use it,
// so removing it can say what it would touch.
export interface OptionInfo {
  label: string;
  isDefault: boolean;
  uses: number;
}

export type OptionList = Record<OptionCategory, OptionInfo[]>;

// Puts a label into an entry's mediums in place of another, keeping its
// position; when the entry already has the new label, the old one just goes.
export function renameIn(tags: string[], from: string, to: string) {
  if (!tags.includes(from)) return tags;
  return tags.includes(to)
    ? tags.filter((t) => t !== from)
    : tags.map((t) => (t === from ? to : t));
}
