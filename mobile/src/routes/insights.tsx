import { useLoaderData } from "react-router";
import InsightsView from "@/components/views/InsightsView";
import { getStats } from "../local/stats";
import { timeZone } from "./util";

export const loader = () => getStats(timeZone());

export function Component() {
  const stats = useLoaderData<typeof loader>();
  return <InsightsView stats={stats} timeZone={timeZone()} />;
}
