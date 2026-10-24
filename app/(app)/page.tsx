import { getSession, requireUserId } from "@/lib/api";
import { listPersons } from "@/lib/queries";
import PersonGrid from "@/components/PersonGrid";
import { EmptyState, PageHeader } from "@/components/StateViews";
import LogButton from "@/components/log/LogButton";

export default async function HomePage() {
  const userId = await requireUserId();
  const [session, persons] = await Promise.all([
    getSession(),
    listPersons(userId, "lastLogged"),
  ]);
  const n = persons.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          session?.user?.name ? `Hey, ${session.user.name}` : "Welcome back"
        }
        sub={`${n} person${n !== 1 ? "s" : ""}/character${n !== 1 ? "s" : ""} tracked & gooned`}
      />

      {persons.length === 0 ? (
        <EmptyState
          title="Log your first entry"
          sub="Persons you log will show up here, most recent first."
          action={<LogButton label="Log entry" />}
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="section-label">Recently gooned</h2>
          <PersonGrid persons={persons} />
        </section>
      )}
    </div>
  );
}
