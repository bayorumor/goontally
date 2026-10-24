"use client";

import { useState } from "react";
import { Entry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { fetchEntriesAfter } from "@/lib/entryPages";
import { useFeedback } from "@/components/ui/Feedback";

const PAGE_SIZE = 20;

interface Props {
  personId: number;
  initialEntries: Entry[];
  total: number;
  timeZone: string;
}

// Entry history on a person's page, with "Load more" paging.
export default function PersonEntryList({
  personId,
  initialEntries,
  total,
  timeZone,
}: Props) {
  const { toast } = useFeedback();
  const [entries, setEntries] = useState(initialEntries);
  const [count, setCount] = useState(total);

  // "Log again" refreshes the server page with new props; start over from
  // them so the new entry shows up.
  const [prevInitial, setPrevInitial] = useState(initialEntries);
  if (initialEntries !== prevInitial) {
    setPrevInitial(initialEntries);
    setEntries(initialEntries);
    setCount(total);
  }
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchEntriesAfter(entries[entries.length - 1], {
        personId,
        limit: PAGE_SIZE,
      });
      setEntries((prev) => [...prev, ...data.entries]);
      setCount(data.total);
    } catch {
      toast("Couldn't load more. Check your connection.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="card divide-y divide-border">
        {entries.map((e) => {
          const others = e.persons.filter((p) => p.id !== personId);
          return (
            <li key={e.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[14px] font-semibold">
                  {formatDateTime(e.loggedAt, timeZone)}
                </span>
                {others.length > 0 && (
                  <span className="text-[13px] text-muted">
                    with {others.map((p) => p.name).join(", ")}
                  </span>
                )}
              </div>
              {(e.mediumTags.length > 0 || e.thoughts.length > 0) && (
                <div className="chip-row">
                  {e.thoughts.map((t) => (
                    <span key={t.id} className="chip chip--primary">
                      {t.tag}
                    </span>
                  ))}
                  {e.mediumTags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {e.notes && <p className="text-[14px] text-muted">{e.notes}</p>}
            </li>
          );
        })}
      </ul>
      {entries.length < count && (
        <button
          className="btn btn-secondary self-center"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
