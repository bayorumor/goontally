import { useLoaderData } from "react-router";
import HistoryList from "@/components/HistoryList";
import { HISTORY_PAGE_SIZE } from "@/lib/entryPages";
import { listEntries } from "../local/queries";
import { timeZone } from "./util";

export const loader = () => listEntries({ limit: HISTORY_PAGE_SIZE });

export function Component() {
  const { entries, total } = useLoaderData<typeof loader>();
  return (
    <HistoryList
      initialEntries={entries}
      total={total}
      pageSize={HISTORY_PAGE_SIZE}
      timeZone={timeZone()}
    />
  );
}
