import { requireUserId } from "@/lib/api";
import { getStats } from "@/lib/stats";
import { getViewerTimeZone } from "@/lib/viewer";
import InsightsView from "@/components/views/InsightsView";

export default async function InsightsPage() {
  const userId = await requireUserId();
  const timeZone = await getViewerTimeZone();
  const stats = await getStats(userId, timeZone);
  return <InsightsView stats={stats} timeZone={timeZone} />;
}
