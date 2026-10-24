import { parseId, requireUserId } from "@/lib/api";
import { listGroupRefs, listPersonsWithGroups } from "@/lib/queries";
import AddForm from "@/components/add/AddForm";

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const userId = await requireUserId();
  const [{ group }, groups, persons] = await Promise.all([
    searchParams,
    listGroupRefs(userId),
    listPersonsWithGroups(userId),
  ]);

  return (
    <AddForm
      groups={groups}
      allPersons={persons}
      initialGroupId={parseId(group) ?? undefined}
    />
  );
}
