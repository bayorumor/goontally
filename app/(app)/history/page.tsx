import { requireUserId } from "@/lib/api";
import { listEntries } from "@/lib/queries";
import { getViewerTimeZone } from "@/lib/viewer";
import HistoryList from "@/components/HistoryList";

const PAGE_SIZE = 30;

export default async function HistoryPage() {
  const userId = await requireUserId();
  const [{ entries, total }, timeZone] = await Promise.all([
    listEntries(userId, { limit: PAGE_SIZE }),
    getViewerTimeZone(),
  ]);

  return (
    <HistoryList
      initialEntries={entries}
      total={total}
      pageSize={PAGE_SIZE}
      timeZone={timeZone}
    />
  );
}
