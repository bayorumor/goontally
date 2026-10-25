"use client";

import { DraftThought } from "@/lib/types";
import TagPicker from "./TagPicker";

export interface ThoughtTarget {
  key: string;
  name: string;
}

interface Props {
  thoughts: DraftThought[];
  onChange: (thoughts: DraftThought[]) => void;
  persons: ThoughtTarget[];
  options: string[];
  onAddCustom: (label: string) => Promise<void>;
  // Set after a save attempt with a thought nobody was picked for.
  showErrors: boolean;
}

export default function ThoughtSelect({
  thoughts,
  onChange,
  persons,
  options,
  onAddCustom,
  showErrors,
}: Props) {
  const toggle = (tag: string) => {
    if (thoughts.some((t) => t.tag === tag)) {
      onChange(thoughts.filter((t) => t.tag !== tag));
    } else {
      onChange([...thoughts, { tag, keys: [] }]);
    }
  };

  const toggleKey = (tag: string, key: string) =>
    onChange(
      thoughts.map((t) =>
        t.tag !== tag
          ? t
          : {
              ...t,
              keys: t.keys.includes(key)
                ? t.keys.filter((k) => k !== key)
                : [...t.keys, key],
            },
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      <TagPicker
        options={options}
        selected={thoughts.map((t) => t.tag)}
        onToggle={toggle}
        onAddCustom={onAddCustom}
        placeholder="Custom finish"
      />

      {/* With one person every thought is about them; with several, each
          picked thought has to say who it was for. */}
      {persons.length > 1 &&
        thoughts.map((thought) => {
          const missing = thought.keys.length === 0;
          const flagged = missing && showErrors;
          return (
            <div
              key={thought.tag}
              className={`rounded-md border p-3 transition-colors ${
                flagged
                  ? "border-danger/60 bg-danger-soft"
                  : "border-transparent bg-surface-1"
              }`}
            >
              <p className="mb-2 flex items-baseline justify-between gap-2 text-[13px] text-muted">
                <span>
                  <span className="font-semibold text-text">{thought.tag}</span>{" "}
                  for
                </span>
                {missing && (
                  <span className={flagged ? "text-danger" : "text-subtle"}>
                    Pick at least one
                  </span>
                )}
              </p>
              <div className="chip-row">
                {persons.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="chip"
                    aria-pressed={thought.keys.includes(p.key)}
                    onClick={() => toggleKey(thought.tag, p.key)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
