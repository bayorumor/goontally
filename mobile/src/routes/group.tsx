import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import GroupView from "@/components/views/GroupView";
import { getGroupDetail } from "../local/queries";
import { notFound, parseId } from "./util";

export async function loader({ params }: LoaderFunctionArgs) {
  const groupId = parseId(params.id);
  const detail = groupId ? await getGroupDetail(groupId) : null;
  if (!detail) notFound();
  return detail;
}

export function Component() {
  const { group, stats } = useLoaderData<typeof loader>();
  return <GroupView key={group.id} group={group} stats={stats} />;
}
