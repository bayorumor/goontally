import { requireUserId } from "@/lib/api";
import { listGroups, listPersons } from "@/lib/queries";
import LibraryView from "@/components/LibraryView";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await requireUserId();
  const [{ tab }, persons, groups] = await Promise.all([
    searchParams,
    listPersons(userId, "name"),
    listGroups(userId),
  ]);

  return (
    <LibraryView
      persons={persons}
      groups={groups}
      initialTab={tab === "groups" ? "groups" : "persons"}
    />
  );
}
