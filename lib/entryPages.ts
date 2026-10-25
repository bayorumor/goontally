import { Entry } from "./types";

// Entries per page: History, and a person's entry history. Shared by the web
// pages, the Android routes and the "Load more" buttons.
export const HISTORY_PAGE_SIZE = 30;
export const PERSON_PAGE_SIZE = 20;

// The page of entries after `last` (newest first), for "Load more" buttons.
// Throws when the request fails.
export async function fetchEntriesAfter(
  last: Entry,
  query: { limit: number; personId?: number },
): Promise<{ entries: Entry[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    afterAt: last.loggedAt,
    afterId: String(last.id),
    ...(query.personId ? { personId: String(query.personId) } : {}),
  });
  const res = await fetch(`/api/entries?${params}`);
  if (!res.ok) throw new Error(`Couldn't load entries (${res.status})`);
  return res.json();
}
