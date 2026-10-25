"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useFeedback } from "@/components/ui/Feedback";
import type { OptionCategory, OptionInfo, OptionList } from "@/lib/options";

const SECTIONS: { category: OptionCategory; title: string }[] = [
  { category: "thought", title: "Finishes" },
  { category: "medium", title: "Mediums" },
];

const entries = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;

async function fetchOptions(): Promise<OptionList> {
  const res = await fetch("/api/options", { cache: "no-store" });
  if (!res.ok) throw new Error(`options ${res.status}`);
  return res.json();
}

async function send(method: "PATCH" | "DELETE", body: object) {
  const res = await fetch("/api/options", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong, please try again");
  }
}

// The finishes and mediums offered when logging, to rename or remove. Opens
// from Settings (Profile on the web) and from the log sheet's "Edit" links.
// Entries store the label itself, so renaming changes past entries too,
// while removing only stops offering it unless asked to clear them as well.
export default function OptionsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [list, setList] = useState<OptionList | null>(null);
  const [editing, setEditing] = useState<{
    category: OptionCategory;
    label: string;
    value: string;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    category: OptionCategory;
    option: OptionInfo;
    fromEntries: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      fetchOptions()
        .then(setList)
        .catch(() => toast("Couldn't load the options", "error")),
    [toast],
  );

  // Each opening starts with nothing being edited.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setEditing(null);
    setRemoving(null);
  }

  // Fresh every time it opens: entries may have been logged since.
  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchOptions()
      .then((next) => live && setList(next))
      .catch(() => live && toast("Couldn't load the options", "error"));
    return () => {
      live = false;
    };
  }, [open, toast]);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast(done);
      await load();
      router.refresh();
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!editing) return;
    const to = editing.value.trim();
    if (!to || to === editing.label) return setEditing(null);
    const ok = await run(
      () => send("PATCH", { category: editing.category, from: editing.label, to }),
      `Renamed to "${to}"`,
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (!removing) return;
    const { category, option, fromEntries } = removing;
    const ok = await run(
      () => send("DELETE", { category, label: option.label, fromEntries }),
      fromEntries
        ? `"${option.label}" removed, from ${entries(option.uses)} too`
        : `"${option.label}" removed`,
    );
    if (ok) setRemoving(null);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={() => !busy && onClose()}
        title="Log options"
      >
        {!list ? (
          <div className="flex flex-col gap-3 pt-1">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-[13px] text-subtle">
              Renaming also changes past entries. Removing stops offering it
              when you log; past entries keep it unless you choose otherwise.
            </p>
            {SECTIONS.map(({ category, title }) => (
              <section key={category}>
                <h3 className="label">{title}</h3>
                {list[category].length === 0 ? (
                  <p className="text-[14px] text-muted">None left.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {list[category].map((option) =>
                      editing?.category === category &&
                      editing.label === option.label ? (
                        <li key={option.label} className="flex gap-2 p-2">
                          <input
                            className="input !h-9 flex-1"
                            autoFocus
                            maxLength={100}
                            aria-label={`New name for ${option.label}`}
                            value={editing.value}
                            onChange={(e) =>
                              setEditing({ ...editing, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void rename();
                            }}
                          />
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditing(null)}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={rename}
                            disabled={busy || !editing.value.trim()}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </li>
                      ) : (
                        <li
                          key={option.label}
                          className="flex items-center gap-2 py-1 pl-3 pr-1"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">
                              {option.label}
                            </span>
                            <span className="block text-[12px] text-subtle">
                              {option.isDefault ? "Built-in · " : ""}
                              {entries(option.uses)}
                            </span>
                          </span>
                          <button
                            className="icon-btn"
                            aria-label={`Rename ${option.label}`}
                            disabled={busy}
                            onClick={() =>
                              setEditing({
                                category,
                                label: option.label,
                                value: option.label,
                              })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-btn hover:!text-danger"
                            aria-label={`Remove ${option.label}`}
                            disabled={busy}
                            onClick={() =>
                              setRemoving({ category, option, fromEntries: false })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!removing}
        onClose={() => !busy && setRemoving(null)}
        title={removing ? `Remove "${removing.option.label}"?` : ""}
        footer={
          <div className="flex gap-3">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger flex-1"
              onClick={remove}
              disabled={busy}
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        }
      >
        {removing && (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-muted">
              It won&apos;t be offered when you log anymore. Typing it again
              under Custom brings it back.
            </p>
            {removing.option.uses > 0 && (
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-[14px]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  checked={removing.fromEntries}
                  onChange={(e) =>
                    setRemoving({ ...removing, fromEntries: e.target.checked })
                  }
                />
                <span>
                  Also remove it from {entries(removing.option.uses)}
                  <span className="block text-[13px] text-subtle">
                    {removing.fromEntries
                      ? "History and Insights won't show it anymore. This can't be undone."
                      : "Left unticked, those entries keep it."}
                  </span>
                </span>
              </label>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
