import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { SQUARE_ASPECT, thumb } from "@/lib/image";
import { titleCase } from "@/lib/format";
import PersonGrid from "@/components/PersonGrid";
import PhotoUploader from "@/components/PhotoUploader";
import DeleteButton from "@/components/DeleteButton";
import RenameButton from "@/components/RenameButton";
import BackLink from "@/components/BackLink";
import AmbientBackdrop from "@/components/AmbientBackdrop";
import Stat from "@/components/ui/Stat";
import type { GroupStats, GroupWithMembers } from "@/lib/types";

// A group's page. Rendered by the web page and by the Android app.
export default function GroupView({
  group,
  stats,
}: {
  group: GroupWithMembers;
  stats: GroupStats;
}) {
  return (
    <div className="relative isolate flex flex-col gap-6">
      <AmbientBackdrop src={group.photoUrl} />
      <BackLink href="/library?tab=groups" label="Groups" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="relative h-32 w-32 shrink-0 self-center sm:self-auto">
          {group.photoUrl ? (
            <img
              src={thumb(group.photoUrl, 128, { square: true })}
              alt={group.name}
              className="h-full w-full rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-border bg-surface-1 text-[44px] font-bold text-subtle">
              {titleCase(group.name).charAt(0)}
            </div>
          )}
          <PhotoUploader
            endpoint={`/api/groups/${group.id}`}
            aspect={SQUARE_ASPECT}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-1">
            <h1 className="truncate text-[28px] font-bold tracking-tight">
              {titleCase(group.name)}
            </h1>
            <RenameButton
              endpoint={`/api/groups/${group.id}`}
              currentName={group.name}
              noun="group"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat
              value={group.persons.length}
              label={group.persons.length === 1 ? "Member" : "Members"}
            />
            <Stat value={stats.totalEntries} label="Entries" />
            <Stat
              value={stats.topPerson ? titleCase(stats.topPerson.name) : "—"}
              label="Top person"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/add?group=${group.id}`} className="btn btn-secondary">
              <UserRoundPlus size={17} /> Add members
            </Link>
            <DeleteButton
              endpoint={`/api/groups/${group.id}`}
              confirmTitle={`Delete ${titleCase(group.name)}?`}
              confirmMessage="Members stay in your library; only the group goes away."
              redirectTo="/library?tab=groups"
              label="Delete"
            />
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">Members</h2>
        {group.persons.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[14px] text-muted">
            No members yet.
          </p>
        ) : (
          <PersonGrid
            persons={group.persons.map((p) => ({
              ...p,
              groups: [],
              entryCount: stats.memberCounts[p.id] ?? 0,
            }))}
            showGroups={false}
          />
        )}
      </section>
    </div>
  );
}
