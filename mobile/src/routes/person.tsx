import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import PersonView from "@/components/views/PersonView";
import { PERSON_PAGE_SIZE } from "@/lib/entryPages";
import { getPerson, listEntries } from "../local/queries";
import { notFound, parseId, timeZone } from "./util";

export async function loader({ params }: LoaderFunctionArgs) {
  const personId = parseId(params.id);
  if (!personId) notFound();
  const [person, { entries, total }] = await Promise.all([
    getPerson(personId),
    listEntries({ personId, limit: PERSON_PAGE_SIZE }),
  ]);
  if (!person) notFound();
  return { person, entries, total };
}

export function Component() {
  const { person, entries, total } = useLoaderData<typeof loader>();
  return (
    <PersonView
      key={person.id}
      person={person}
      entries={entries}
      total={total}
      timeZone={timeZone()}
    />
  );
}
