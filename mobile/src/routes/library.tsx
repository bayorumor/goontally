import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import LibraryView from "@/components/LibraryView";
import { listGroups, listPersons } from "../local/queries";

export async function loader({ request }: LoaderFunctionArgs) {
  const tab = new URL(request.url).searchParams.get("tab");
  const [persons, groups] = await Promise.all([
    listPersons("name"),
    listGroups(),
  ]);
  return {
    persons,
    groups,
    tab: tab === "groups" ? ("groups" as const) : ("persons" as const),
  };
}

export function Component() {
  const { persons, groups, tab } = useLoaderData<typeof loader>();
  return (
    <LibraryView key={tab} persons={persons} groups={groups} initialTab={tab} />
  );
}
