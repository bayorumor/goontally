"use client";

import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { titleCase } from "@/lib/format";
import { NAME_MAX } from "@/lib/constants";
import { Person } from "@/lib/types";

// A person picked for the entry: either an existing one or a new name.
export interface PickedPerson {
  key: string;
  person: Person | null;
  newName: string;
}

interface Props {
  persons: Person[];
  picked: PickedPerson[];
  onPick: (p: PickedPerson) => void;
  onRemove: (key: string) => void;
}

const SUGGESTIONS = 6;
let uid = 0;

// Multi-select person search. With an empty query it suggests the most
// recently logged persons, so a repeat log is two taps.
export default function PersonPicker({
  persons,
  picked,
  onPick,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const q = query.trim().toLowerCase();
  // Once someone is picked, suggestions only show while searching, which
  // keeps the sheet short for the common one-person log.
  const showList = !picked.length || focused || !!q;

  const pickedIds = new Set(
    picked.flatMap((p) => (p.person ? [p.person.id] : [])),
  );
  const matches = persons
    .filter((p) => !pickedIds.has(p.id) && p.name.toLowerCase().includes(q))
    .slice(0, SUGGESTIONS);
  const exists =
    persons.some((p) => p.name.toLowerCase() === q) ||
    picked.some((p) => p.newName.toLowerCase() === q);

  const pickExisting = (person: Person) => {
    onPick({ key: `p${person.id}`, person, newName: "" });
    setQuery("");
  };
  const pickNew = () => {
    onPick({ key: `new${++uid}`, person: null, newName: query.trim() });
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-3">
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((p) => {
            const name = p.person?.name ?? p.newName;
            return (
              <span
                key={p.key}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-primary-soft pl-1 pr-1.5 text-[14px] font-medium text-primary-text"
              >
                <Avatar src={p.person?.photoUrl} name={name} size={28} />
                {titleCase(name)}
                {!p.person && (
                  <span className="text-[11px] font-semibold uppercase opacity-70">
                    new
                  </span>
                )}
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-3"
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove(p.key)}
                >
                  <X size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
        />
        <input
          className="input !pl-10"
          placeholder={picked.length ? "Add another person" : "Search persons"}
          value={query}
          maxLength={NAME_MAX}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches[0]) pickExisting(matches[0]);
            else if (q && !exists) pickNew();
          }}
          autoComplete="off"
        />
      </div>

      {showList && (
        <div className="overflow-hidden rounded-md border border-border">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              // Keep the input focused so the list stays open for the next pick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickExisting(p)}
              className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-3"
            >
              <Avatar src={p.photoUrl} name={p.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">
                  {titleCase(p.name)}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {p.groups.length
                    ? p.groups.map((g) => g.name).join(", ")
                    : "Ungrouped"}
                </span>
              </span>
            </button>
          ))}
          {!matches.length && !q && (
            <p className="px-3 py-3 text-[14px] text-muted">
              {persons.length
                ? "Everyone's already picked."
                : "Type a name to add your first person."}
            </p>
          )}
          {!matches.length && q && exists && (
            <p className="px-3 py-3 text-[14px] text-muted">Already picked.</p>
          )}
        </div>
      )}

      {/* Kept apart from the matches so it isn't tapped by accident. */}
      {q && !exists && (
        <button
          type="button"
          onClick={pickNew}
          className="flex items-center gap-2 self-start rounded-md px-1 text-[14px] font-medium text-primary-text hover:underline"
        >
          <Plus size={16} /> Add &ldquo;{query.trim()}&rdquo; as a new person
        </button>
      )}
    </div>
  );
}
