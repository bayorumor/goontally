"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NAME_MAX } from "@/lib/constants";

interface Props {
  defaults: string[];
  custom: string[];
  selected: string[];
  onToggle: (label: string) => void;
  // Saves a new custom label; it's selected once saved.
  onAddCustom: (label: string) => Promise<void>;
  placeholder: string;
}

// Toggleable chips for a fixed list plus the user's own labels.
export default function TagPicker({
  defaults,
  custom,
  selected,
  onToggle,
  onAddCustom,
  placeholder,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const options = [...defaults, ...custom.filter((l) => !defaults.includes(l))];

  const add = async () => {
    const label = value.trim();
    setValue("");
    setAdding(false);
    if (!label) return;
    if (!options.some((o) => o.toLowerCase() === label.toLowerCase()))
      await onAddCustom(label);
    if (!selected.includes(label)) onToggle(label);
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
