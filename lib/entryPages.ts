import { Entry } from "./types";

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
