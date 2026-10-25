import { useLoaderData } from "react-router";
import HistoryList from "@/components/HistoryList";
import { listEntries } from "../local/queries";
import { timeZone } from "./util";

const PAGE_SIZE = 30;

export const loader = () => listEntries({ limit: PAGE_SIZE });

export function Component() {
  const { entries, total } = useLoaderData<typeof loader>();
  return (
    <HistoryList
      initialEntries={entries}
      total={total}
      pageSize={PAGE_SIZE}
      timeZone={timeZone()}
    />
  );
}
