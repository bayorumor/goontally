"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ClampedChips from "@/components/ui/ClampedChips";
import { useFeedback } from "@/components/ui/Feedback";
import { EmptyState, PageHeader } from "@/components/StateViews";
import LogButton from "@/components/log/LogButton";
import { useQuickLog } from "@/components/log/QuickLog";
import { Entry } from "@/lib/types";
import { fetchEntriesAfter } from "@/lib/entryPages";

// Finish and medium chips are a size smaller on phones, where rows are tight.
const SMALL_CHIP = "max-md:h-5 max-md:px-2 max-md:text-[11px]";

interface Props {
  initialEntries: Entry[];
  total: number;
  pageSize: number;
  timeZone: string;
}

const dayKey = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone });

const dayLabel = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });

const timeLabel = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

// Timeline of entries grouped by day, newest first.
export default function HistoryList({
  initialEntries,
  total: initialTotal,
  pageSize,
  timeZone,
}: Props) {
  const { confirm, toast } = useFeedback();
  const { editEntry } = useQuickLog();
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);

  // A save from the log sheet refreshes the server page, which hands us new
  // props; start over from them so new and edited entries show up.
  const [prevInitial, setPrevInitial] = useState(initialEntries);
  if (initialEntries !== prevInitial) {
    setPrevInitial(initialEntries);
    setEntries(initialEntries);
    setTotal(initialTotal);
  }
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchEntriesAfter(entries[entries.length - 1], {
        limit: pageSize,
      });
      setEntries((prev) => [...prev, ...data.entries]);
      setTotal(data.total);
    } catch {
      toast("Couldn't load more. Check your connection.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (entry: Entry) => {
    const ok = await confirm({
      title: "Delete this log?",
      message: `${entry.persons.map((p) => p.name).join(", ")} · ${timeLabel(entry.loggedAt, timeZone)}`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setDeletingId(entry.id);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        setTotal((t) => t - 1);
        toast("Log deleted");
      } else {
        toast("Couldn't delete the log", "error");
      }
    } catch {
      toast("Couldn't delete. Check your connection.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Consecutive entries on the same local day share a header.
  const days: { key: string; label: string; entries: Entry[] }[] = [];
  for (const e of entries) {
    const key = dayKey(e.loggedAt, timeZone);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(e);
    else
      days.push({ key, label: dayLabel(e.loggedAt, timeZone), entries: [e] });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        sub={`${total} log${total !== 1 ? "s" : ""} recorded`}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          sub="Every log you make shows up here, grouped by day."
          action={<LogButton label="Log entry" />}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.key} className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-muted">
                {day.label}
              </h2>
              <ul className="card divide-y divide-border">
                {day.entries.map((e) => (
                  <li
                    key={e.id}
                    className={`flex items-center gap-4 px-4 py-3 transition-opacity ${deletingId === e.id ? "opacity-40" : ""}`}
                  >
                    {/* Phones show the first person with a "+N" badge; a
                        stack of three would squeeze the names and chips. */}
                    <span className="relative shrink-0 md:hidden">
                      <Avatar
                        src={e.persons[0]?.photoUrl ?? null}
                        name={e.persons[0]?.name ?? ""}
                        size={48}
                      />
                      {e.persons.length > 1 && (
                        <span className="absolute -bottom-1 -right-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-surface-3 px-1 text-[11px] font-semibold text-text ring-2 ring-surface-1">
                          +{e.persons.length - 1}
                        </span>
                      )}
                    </span>
                    <span className="hidden shrink-0 -space-x-4 md:flex">
                      {e.persons.slice(0, 3).map((p) => (
                        <Avatar
                          key={p.id}
                          src={p.photoUrl}
                          name={p.name}
                          size={52}
                          className="ring-2 ring-surface-1"
                        />
                      ))}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {/* Two lines at most, ending in "…"; a long name with
                          no spaces breaks instead of running into the time. */}
                      <p className="line-clamp-2 min-w-0 text-[15px] font-semibold wrap-anywhere">
                        {e.persons.map((p, i) => (
                          <span key={p.id}>
                            {i > 0 && <span className="text-muted">, </span>}
                            <Link
                              href={`/persons/${p.id}`}
                              className="hover:underline"
                            >
                              {p.name}
                            </Link>
                          </span>
                        ))}
                      </p>
                      {/* Two lines at most, like the names; "+N" for the rest. */}
                      {(e.thoughts.length > 0 || e.mediumTags.length > 0) && (
                        <ClampedChips
                          chipClassName={SMALL_CHIP}
                          items={[
                            ...e.thoughts.map((t) => ({
                              key: `t${t.id}`,
                              label: t.tag,
                              className: "chip--primary",
                            })),
                            ...e.mediumTags.map((tag) => ({
                              key: `m${tag}`,
                              label: tag,
                            })),
                          ]}
                        />
                      )}
                      {e.notes && (
                        <p className="text-[14px] text-muted">{e.notes}</p>
                      )}
                    </div>

                    {/* Time and actions share one vertically centred group. */}
                    <div className="-mr-2 flex shrink-0 items-center">
                      <span className="mr-2 text-[13px] tabular-nums text-muted">
                        {timeLabel(e.loggedAt, timeZone)}
                      </span>
                      <button
                        className="icon-btn"
                        onClick={() => editEntry(e)}
                        disabled={deletingId === e.id}
                        aria-label="Edit log"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn hover:!text-danger"
                        onClick={() => handleDelete(e)}
                        disabled={deletingId === e.id}
                        aria-label="Delete log"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {entries.length < total && (
            <button
              className="btn btn-secondary self-center"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
