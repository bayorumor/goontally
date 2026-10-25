import PersonGrid from "@/components/PersonGrid";
import { EmptyState, PageHeader } from "@/components/StateViews";
import LogButton from "@/components/log/LogButton";
import type { PersonWithCount } from "@/lib/types";

// Home: everyone logged, most recent first. Rendered by the web page and by
// the Android app.
export default function HomeView({
  title,
  persons,
}: {
  title: string;
  persons: PersonWithCount[];
}) {
  const n = persons.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
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
