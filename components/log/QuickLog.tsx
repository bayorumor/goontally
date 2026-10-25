"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useFeedback } from "@/components/ui/Feedback";
import PhotoCropperModal from "@/components/PhotoCropperModal";
import PhotoSlot from "@/components/ui/PhotoSlot";
import { DEFAULT_MEDIUMS } from "@/lib/constants";
import { titleCase } from "@/lib/format";
import { PERSON_ASPECT, SQUARE_ASPECT } from "@/lib/image";
import { DraftThought, Entry, Group, Person } from "@/lib/types";
import GroupSelect from "./GroupSelect";
import PersonPicker, { PickedPerson } from "./PersonPicker";
import TagPicker from "./TagPicker";
import ThoughtSelect from "./ThoughtSelect";

interface LogData {
  persons: Person[];
  groups: Group[];
  thoughtOptions: string[];
  mediumOptions: string[];
}

// Extra details for a person that doesn't exist yet.
interface NewPersonExtras {
  group: Group | null;
  newGroupName: string;
  photo: File | null;
  // Photo for a group that's being created along with the person.
  groupPhoto: File | null;
}

// openLog(person) starts the sheet with that person already picked;
// editEntry(entry) opens it prefilled to change an existing entry.
const QuickLogContext = createContext<{
  openLog: (person?: Person) => void;
  editEntry: (entry: Entry) => void;
} | null>(null);

export function useQuickLog() {
  const ctx = useContext(QuickLogContext);
  if (!ctx) throw new Error("useQuickLog must be used inside QuickLogProvider");
  return ctx;
}

// "YYYY-MM-DDTHH:mm" in the browser's local time, for datetime-local.
const toInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function QuickLogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  // Set while editing an existing entry; null when logging a new one.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [data, setData] = useState<LogData | null>(null);

  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [extras, setExtras] = useState<Record<string, NewPersonExtras>>({});
  const [loggedAt, setLoggedAt] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [thoughts, setThoughts] = useState<DraftThought[]>([]);
  const [mediumTags, setMediumTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  // Turns on after a save attempt with a thought nobody was picked for.
  const [showThoughtErrors, setShowThoughtErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [cropping, setCropping] = useState<{
    key: string;
    file: File;
    target: "person" | "group";
  } | null>(null);

  const loadData = useCallback(() => {
    // Always refetch: persons may have been added or renamed elsewhere.
    fetch("/api/log-data")
      .then((r) => {
        if (!r.ok) throw new Error(`log-data ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() =>
        setError("Couldn't load your persons. Close and try again."),
      );
  }, []);

  const openLog = useCallback(
    (person?: Person) => {
      setEditingId(null);
      setPicked(person ? [{ key: `p${person.id}`, person, newName: "" }] : []);
      setExtras({});
      setLoggedAt(toInput(new Date()));
      setShowDetails(false);
      setThoughts([]);
      setMediumTags([]);
      setNotes("");
      setError("");
      setShowThoughtErrors(false);
      setOpen(true);
      loadData();
    },
    [loadData],
  );

  const editEntry = useCallback(
    (entry: Entry) => {
      setEditingId(entry.id);
      setPicked(
        entry.persons.map((person) => ({
          key: `p${person.id}`,
          person,
          newName: "",
        })),
      );
      setExtras({});
      setLoggedAt(toInput(new Date(entry.loggedAt)));
      setThoughts(
        entry.thoughts.map((t) => ({
          tag: t.tag,
          keys: t.personIds.map((id) => `p${id}`),
        })),
      );
      setMediumTags(entry.mediumTags);
      setNotes(entry.notes ?? "");
      setShowDetails(
        entry.thoughts.length > 0 ||
          entry.mediumTags.length > 0 ||
          !!entry.notes,
      );
      setError("");
      setShowThoughtErrors(false);
      setOpen(true);
      loadData();
    },
    [loadData],
  );

  const close = useCallback(() => {
    if (!savingRef.current) setOpen(false);
  }, []);

  const pick = (p: PickedPerson) => {
    setPicked((prev) => [...prev, p]);
    if (!p.person)
      setExtras((prev) => ({
        ...prev,
        [p.key]: {
          group: null,
          newGroupName: "",
          photo: null,
          groupPhoto: null,
        },
      }));
  };
  const remove = (key: string) => {
    setPicked((prev) => prev.filter((p) => p.key !== key));
    // A thought aimed only at the removed person needs a new pick.
    setThoughts((prev) =>
      prev.map((t) => ({ ...t, keys: t.keys.filter((k) => k !== key) })),
    );
  };
  const updateExtras = (key: string, patch: Partial<NewPersonExtras>) =>
    setExtras((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const addOption = async (category: "thought" | "medium", label: string) => {
    // The option is still usable in this log if saving it for later fails.
    const res = await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, label }),
    }).catch(() => null);
    if (!res?.ok) toast(`Couldn't save "${label}" for next time`, "error");
    setData(
      (prev) =>
        prev && {
          ...prev,
          [category === "thought" ? "thoughtOptions" : "mediumOptions"]: [
            ...(category === "thought"
              ? prev.thoughtOptions
              : prev.mediumOptions),
            label,
          ],
        },
    );
  };

  const save = async () => {
    if (savingRef.current) return;
    if (!picked.length) {
      setError("Pick at least one person");
      return;
    }
    const when = new Date(loggedAt);
    if (isNaN(when.getTime())) {
      setError("Pick a date and time");
      return;
    }
    // With several persons, every picked thought must say who it was for.
    const unassigned =
      picked.length > 1 ? thoughts.filter((t) => t.keys.length === 0) : [];
    if (unassigned.length) {
      setShowDetails(true);
      setShowThoughtErrors(true);
      setError(
        `Pick who ${unassigned.map((t) => `"${t.tag}"`).join(", ")} was for`,
      );
      return;
    }
    setError("");
    savingRef.current = true;
    setSaving(true);

    try {
      const fd = new FormData();
      const rows = picked.map((p) => {
        if (p.person) return { personId: p.person.id };
        const x = extras[p.key];
        const row: Record<string, string | number> = {
          newPersonName: p.newName,
        };
        if (x?.photo) {
          row.personPhotoKey = p.key;
          fd.append(`photo:${p.key}`, x.photo);
        }
        if (x?.newGroupName) {
          row.newGroupName = x.newGroupName;
          if (x.groupPhoto) {
            row.groupPhotoKey = `${p.key}g`;
            fd.append(`photo:${p.key}g`, x.groupPhoto);
          }
        } else if (x?.group) row.groupId = x.group.id;
        return row;
      });
      fd.append(
        "data",
        JSON.stringify({
          loggedAt: when.toISOString(),
          persons: rows,
          // Thoughts point at persons by row; one person needs no rows.
          thoughts: thoughts.map((t) => ({
            tag: t.tag,
            rows:
              picked.length > 1
                ? picked.flatMap((p, i) => (t.keys.includes(p.key) ? [i] : []))
                : [],
          })),
          mediumTags,
          notes: notes.trim() || null,
        }),
      );

      const res = await fetch(
        editingId ? `/api/entries/${editingId}` : "/api/entries",
        { method: editingId ? "PATCH" : "POST", body: fd },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Couldn't save (${res.status})`);
        return;
      }
      setOpen(false);
      toast(body.warning ?? (editingId ? "Saved" : "Logged"));
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const detailsCount =
    thoughts.length + mediumTags.length + (notes.trim() ? 1 : 0);

  return (
    <QuickLogContext.Provider value={{ openLog, editEntry }}>
      {children}

      {cropping && (
        <PhotoCropperModal
          file={cropping.file}
          aspect={cropping.target === "group" ? SQUARE_ASPECT : PERSON_ASPECT}
          confirmLabel="Use photo"
          onConfirm={(file) => {
            updateExtras(
              cropping.key,
              cropping.target === "group"
                ? { groupPhoto: file }
                : { photo: file },
            );
            setCropping(null);
          }}
          onCancel={() => setCropping(null)}
        />
      )}

      <Sheet
        open={open}
        onClose={close}
        title={editingId ? "Edit log" : "New log"}
        size="lg"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <button
              className="btn btn-primary btn-block"
              onClick={save}
              disabled={saving || !data}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : picked.length > 1
                    ? `Log ${picked.length} persons`
                    : "Log it"}
            </button>
          </div>
        }
      >
        {!data ? (
          <div className="flex flex-col gap-3 pt-1">
            <div className="skeleton h-11" />
            <div className="skeleton h-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-1">
            <section>
              <p className="label">Who</p>
              <PersonPicker
                persons={data.persons}
                picked={picked}
                onPick={pick}
                onRemove={remove}
              />
            </section>

            {picked
              .filter((p) => !p.person)
              .map((p) => {
                const x = extras[p.key];
                if (!x) return null;
                return (
                  <section
                    key={p.key}
                    className="rounded-md border border-border bg-surface-1 p-3"
                  >
                    {/* The person's own photo sits with their name, the
                        group's logo with the group, each in its own shape. */}
                    <div className="flex items-center gap-3">
                      <PhotoSlot
                        shape="portrait"
                        file={x.photo}
                        onPick={(file) =>
                          setCropping({ key: p.key, file, target: "person" })
                        }
                        label={`Add a photo of ${titleCase(p.newName)}`}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] text-muted">
                          New person ·{" "}
                          <span className="font-semibold text-text">
                            {titleCase(p.newName)}
                          </span>
                        </p>
                        <p className="text-[12px] text-subtle">
                          {x.photo
                            ? "Tap the photo to change it"
                            : "Tap the frame to add their photo (optional)"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <GroupSelect
                          value={
                            x.newGroupName
                              ? { id: 0, name: x.newGroupName, photoUrl: null }
                              : x.group
                          }
                          groups={data.groups}
                          onChange={(group) =>
                            updateExtras(p.key, {
                              group,
                              newGroupName: "",
                              groupPhoto: null,
                            })
                          }
                          onNewGroup={(name) =>
                            updateExtras(p.key, {
                              group: null,
                              newGroupName: name,
                            })
                          }
                          placeholder="Group (optional)"
                        />
                      </div>
                      {x.newGroupName && (
                        <PhotoSlot
                          shape="square"
                          file={x.groupPhoto}
                          onPick={(file) =>
                            setCropping({ key: p.key, file, target: "group" })
                          }
                          label={`Add a logo for ${titleCase(x.newGroupName)}`}
                        />
                      )}
                    </div>
                    {x.newGroupName && (
                      <p className="mt-1.5 text-[12px] text-subtle">
                        New group · tap the square to add its logo (optional)
                      </p>
                    )}
                  </section>
                );
              })}

            <section>
              <label className="label" htmlFor="log-when">
                When
              </label>
              <input
                id="log-when"
                type="datetime-local"
                className="input"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
              />
            </section>

            <section className="flex flex-col gap-5">
              <button
                type="button"
                className="flex items-center gap-2 self-start text-[14px] font-semibold text-muted hover:text-text"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
                Details
                {detailsCount > 0 && (
                  <span className="chip chip--primary">{detailsCount}</span>
                )}
              </button>

              {showDetails && (
                <>
                  <div>
                    <p className="label">Where did you finish?</p>
                    <ThoughtSelect
                      thoughts={thoughts}
                      onChange={setThoughts}
                      persons={picked.map((p) => ({
                        key: p.key,
                        name: p.person?.name ?? p.newName,
                      }))}
                      customOptions={data.thoughtOptions}
                      onAddCustom={(label) => addOption("thought", label)}
                      showErrors={showThoughtErrors}
                    />
                  </div>
                  <div>
                    <p className="label">What did you use?</p>
                    <TagPicker
                      defaults={DEFAULT_MEDIUMS}
                      custom={data.mediumOptions}
                      selected={mediumTags}
                      onToggle={(label) =>
                        setMediumTags((prev) =>
                          prev.includes(label)
                            ? prev.filter((t) => t !== label)
                            : [...prev, label],
                        )
                      }
                      onAddCustom={(label) => addOption("medium", label)}
                      placeholder="Custom medium"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="log-notes">
                      Notes
                    </label>
                    <textarea
                      id="log-notes"
                      className="input"
                      rows={3}
                      placeholder="Anything worth remembering"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </QuickLogContext.Provider>
  );
}
