import Link from "next/link";
import { PERSON_ASPECT, thumb } from "@/lib/image";
import { relativeDay, titleCase } from "@/lib/format";
import PhotoUploader from "@/components/PhotoUploader";
import DeleteButton from "@/components/DeleteButton";
import RenameButton from "@/components/RenameButton";
import ZoomablePhoto from "@/components/ZoomablePhoto";
import PersonEntryList from "@/components/PersonEntryList";
import BackLink from "@/components/BackLink";
import AmbientBackdrop from "@/components/AmbientBackdrop";
import LogButton from "@/components/log/LogButton";
import Stat from "@/components/ui/Stat";
import type { Entry, Person } from "@/lib/types";

// A person's page. Rendered by the web page and by the Android app, which
// each load the data their own way.
export default function PersonView({
  person,
  entries,
  total,
  timeZone,
}: {
  person: Person;
  entries: Entry[];
  total: number;
  timeZone: string;
}) {
  return (
    <div className="relative isolate flex flex-col gap-6">
      <AmbientBackdrop src={person.photoUrl} />
      <BackLink href="/library" label="Library" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        <div className="relative w-40 shrink-0 self-center sm:w-52 sm:self-start">
          {person.photoUrl ? (
            <ZoomablePhoto
              src={thumb(person.photoUrl, 208)}
              fullSrc={person.photoUrl}
              alt={person.name}
              className="aspect-[11/16] w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-[11/16] w-full items-center justify-center rounded-lg border border-border bg-surface-1 text-[44px] font-bold text-subtle">
              {titleCase(person.name).charAt(0)}
            </div>
          )}
          <PhotoUploader
            endpoint={`/api/persons/${person.id}`}
            aspect={PERSON_ASPECT}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="flex items-center gap-1">
              <h1 className="truncate text-[28px] font-bold tracking-tight">
                {titleCase(person.name)}
              </h1>
              <RenameButton
                endpoint={`/api/persons/${person.id}`}
                currentName={person.name}
                noun="person"
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {person.groups.length === 0 ? (
                <span className="chip">Ungrouped</span>
              ) : (
                person.groups.map((g) => (
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="chip hover:text-text"
                  >
                    {g.name}
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat value={total} label={total === 1 ? "Entry" : "Entries"} />
            <Stat
              value={
                entries[0] ? relativeDay(entries[0].loggedAt, timeZone) : "—"
              }
              label="Last logged"
            />
            <Stat
              value={person.groups.length}
              label={person.groups.length === 1 ? "Group" : "Groups"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <LogButton label="Log again" person={person} />
            <DeleteButton
              endpoint={`/api/persons/${person.id}`}
              confirmTitle={`Delete ${titleCase(person.name)}?`}
              confirmMessage="Their entries are removed too, unless someone else is in them. This can't be undone."
              redirectTo="/library"
              label="Delete"
            />
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">Entry history</h2>
        {entries.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[14px] text-muted">
            No entries yet.
          </p>
        ) : (
          <PersonEntryList
            personId={person.id}
            initialEntries={entries}
            total={total}
            timeZone={timeZone}
          />
        )}
      </section>
    </div>
  );
}
