import { useLoaderData } from "react-router";
import HomeView from "@/components/views/HomeView";
import { listPersons } from "../local/queries";

export const loader = () => listPersons("lastLogged");

export function Component() {
  const persons = useLoaderData<typeof loader>();
  return <HomeView title="Welcome back" persons={persons} />;
}
