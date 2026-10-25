"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Plus, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { NAME_MAX } from "@/lib/constants";

export interface ComboboxItem {
  id: number;
  name: string;
  photoUrl?: string | null;
}

interface Section<T> {
  label?: string;
  items: T[];
}

interface Props<T extends ComboboxItem> {
  value: T | null;
  placeholder: string;
  // Options grouped under optional headings; filtered by the typed query.
  sections: Section<T>[];
  onChange: (item: T | null) => void;
  // Offered as "Add … as new <noun>" when the query matches no known name.
  onCreate?: (name: string) => void;
  createNoun?: string;
  // Names that count as "already exists"; defaults to every option.
  knownNames?: string[];
  // Extra line under the options, e.g. why an exact match isn't selectable.
  notice?: (query: string) => ReactNode;
  emptyMessage?: (query: string) => string;
  showValueThumb?: boolean;
}

export default function Combobox<T extends ComboboxItem>({
  value,
  placeholder,
  sections,
  onChange,
  onCreate,
  createNoun = "item",
  knownNames,
  notice,
  emptyMessage = (q) => (q ? "No match found" : "Nothing here yet"),
  showValueThumb = false,
}: Props<T>) {
  // What the user is typing; null shows the selected value's name instead.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Drop the draft whenever the selection changes from outside.
  const valueKey = value ? `${value.id}:${value.name}` : "";
  const [prevValueKey, setPrevValueKey] = useState(valueKey);
  if (valueKey !== prevValueKey) {
    setPrevValueKey(valueKey);
    setDraft(null);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const query = draft ?? (value ? value.name : "");
  const q = query.trim().toLowerCase();

  const visible = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => it.name.toLowerCase().includes(q)),
    }))
    .filter((s) => s.items.length > 0);

  const names =
    knownNames ?? sections.flatMap((s) => s.items.map((it) => it.name));
  const showCreate =
    !!onCreate && q !== "" && !names.some((n) => n.toLowerCase() === q);
  const noticeNode = notice?.(q);

  const select = (item: T | null) => {
    setDraft(null);
    onChange(item);
    setOpen(false);
  };

  const withThumb = showValueThumb && value;

  return (
    <div className="relative" ref={ref}>
      {withThumb && (
        <Avatar
          src={value.photoUrl}
          name={value.name}
          size={26}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
        />
      )}
      <input
        className={`input !pr-10 ${withThumb ? "!pl-11" : ""}`}
        placeholder={placeholder}
        maxLength={NAME_MAX}
        value={query}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {query && (
        <button
          className="icon-btn absolute right-1 top-1/2 !h-8 !w-8 -translate-y-1/2"
          onClick={() => select(null)}
          type="button"
          aria-label="Clear"
        >
          <X size={16} />
        </button>
      )}

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-md border border-border-strong bg-surface-3 py-1 shadow-xl">
          {visible.map((section, i) => (
            <div key={section.label ?? i}>
              {i > 0 && <div className="my-1 border-t border-border" />}
              {section.label && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[14px] hover:bg-surface-2 ${
                    value?.id === item.id ? "text-primary-text" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(item);
                  }}
                >
                  <Avatar src={item.photoUrl} name={item.name} size={26} />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          ))}

          {noticeNode && (
            <p className="px-3 py-2 text-[13px] text-muted">{noticeNode}</p>
          )}

          {!visible.length && !showCreate && !noticeNode && (
            <p className="px-3 py-2 text-[13px] text-muted">
              {emptyMessage(q)}
            </p>
          )}

          {/* Kept apart from the matches so it isn't picked by accident. */}
          {showCreate && (
            <div
              className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[14px] font-medium text-primary-text hover:bg-surface-2 ${
                visible.length ? "mt-1 border-t border-border" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                setDraft(null);
                onCreate!(query.trim());
                setOpen(false);
              }}
            >
              <Plus size={16} />
              Add &ldquo;{query.trim()}&rdquo; as new {createNoun}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
