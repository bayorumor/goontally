import { notFound } from "next/navigation";
import { parseId, requireUserId } from "@/lib/api";
import { getGroupDetail } from "@/lib/queries";
import GroupView from "@/components/views/GroupView";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const groupId = parseId((await params).id);
  const detail = groupId ? await getGroupDetail(userId, groupId) : null;
  if (!detail) notFound();

  return <GroupView group={detail.group} stats={detail.stats} />;
}
