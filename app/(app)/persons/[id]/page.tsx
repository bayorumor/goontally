import { notFound } from "next/navigation";
import { parseId, requireUserId } from "@/lib/api";
import { getPerson, listEntries } from "@/lib/queries";
import { getViewerTimeZone } from "@/lib/viewer";
import { PERSON_PAGE_SIZE } from "@/lib/entryPages";
import PersonView from "@/components/views/PersonView";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const personId = parseId((await params).id);
  if (!personId) notFound();

  const [person, { entries, total }, timeZone] = await Promise.all([
    getPerson(userId, personId),
    listEntries(userId, { personId, limit: PERSON_PAGE_SIZE }),
    getViewerTimeZone(),
  ]);
  if (!person) notFound();

  return (
    <PersonView
      person={person}
      entries={entries}
      total={total}
      timeZone={timeZone}
    />
  );
}
