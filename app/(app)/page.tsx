import { getSession, requireUserId } from "@/lib/api";
import { listPersons } from "@/lib/queries";
import HomeView from "@/components/views/HomeView";

export default async function HomePage() {
  const userId = await requireUserId();
  const [session, persons] = await Promise.all([
    getSession(),
    listPersons(userId, "lastLogged"),
  ]);

  return (
    <HomeView
      title={session?.user?.name ? `Hey, ${session.user.name}` : "Welcome back"}
      persons={persons}
    />
  );
}
