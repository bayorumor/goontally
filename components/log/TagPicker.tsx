"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NAME_MAX } from "@/lib/constants";

interface Props {
  // What's offered (lib/options.ts), built-in ones first.
  options: string[];
  selected: string[];
  onToggle: (label: string) => void;
  // Saves a new custom label; it's selected once saved.
  onAddCustom: (label: string) => Promise<void>;
  placeholder: string;
}

// Toggleable chips for the offered labels. A label the entry already has
// shows too, even if it's no longer offered, so editing never drops it
// unseen.
export default function TagPicker({
  options: offered,
  selected,
  onToggle,
  onAddCustom,
  placeholder,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const options = [
    ...offered,
    ...selected.filter((l) => !offered.includes(l)),
  ];

  const add = async () => {
    const label = value.trim();
    setValue("");
    setAdding(false);
    if (!label) return;
    // Typing an existing option in another case picks that option instead
    // of adding a near-duplicate.
    const known = options.find((o) => o.toLowerCase() === label.toLowerCase());
    if (!known) await onAddCustom(label);
    const pick = known ?? label;
    if (!selected.includes(pick)) onToggle(pick);
  };

  return (
    <div className="chip-row">
      {options.map((label) => (
        <button
          key={label}
          type="button"
          className="chip"
          aria-pressed={selected.includes(label)}
          onClick={() => onToggle(label)}
        >
          {label}
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          className="input !h-[34px] !w-40 !rounded-full !text-[13px]"
          placeholder={placeholder}
          value={value}
          maxLength={NAME_MAX}
          onChange={(e) => setValue(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
            if (e.key === "Escape") setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="chip !border-dashed"
          onClick={() => setAdding(true)}
        >
          <Plus size={14} /> Custom
        </button>
      )}
    </div>
  );
}
