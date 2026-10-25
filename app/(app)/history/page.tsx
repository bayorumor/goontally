import { requireUserId } from "@/lib/api";
import { listEntries } from "@/lib/queries";
import { getViewerTimeZone } from "@/lib/viewer";
import { HISTORY_PAGE_SIZE } from "@/lib/entryPages";
import HistoryList from "@/components/HistoryList";

export default async function HistoryPage() {
  const userId = await requireUserId();
  const [{ entries, total }, timeZone] = await Promise.all([
    listEntries(userId, { limit: HISTORY_PAGE_SIZE }),
    getViewerTimeZone(),
  ]);

  return (
    <HistoryList
      initialEntries={entries}
      total={total}
      pageSize={HISTORY_PAGE_SIZE}
      timeZone={timeZone}
    />
  );
}
