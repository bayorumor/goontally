import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import AddForm from "@/components/add/AddForm";
import { listGroupRefs, listPersonsWithGroups } from "../local/queries";
import { parseId } from "./util";

export async function loader({ request }: LoaderFunctionArgs) {
  const group = new URL(request.url).searchParams.get("group");
  const [groups, persons] = await Promise.all([
    listGroupRefs(),
    listPersonsWithGroups(),
  ]);
  return { groups, persons, initialGroupId: parseId(group) ?? undefined };
}

export function Component() {
  const { groups, persons, initialGroupId } = useLoaderData<typeof loader>();
  return (
    <AddForm
      key={initialGroupId}
      groups={groups}
      allPersons={persons}
      initialGroupId={initialGroupId}
    />
  );
}
