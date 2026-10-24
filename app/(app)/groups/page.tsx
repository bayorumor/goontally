import { redirect } from "next/navigation";

export default function GroupsPage() {
  redirect("/library?tab=groups");
}
