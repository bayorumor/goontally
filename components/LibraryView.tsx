"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, UserRoundPlus } from "lucide-react";
import PersonGrid from "@/components/PersonGrid";
import Avatar from "@/components/ui/Avatar";
import { EmptyState } from "@/components/StateViews";
import { titleCase } from "@/lib/format";
import { GroupWithMembers, PersonWithCount } from "@/lib/types";

type Tab = "persons" | "groups";
type Sort = "name" | "most";

interface Props {
  persons: PersonWithCount[];
  groups: GroupWithMembers[];
  initialTab: Tab;
}

// Persons and groups in one place, with search and sort done in the browser
// (the lists are small and already loaded).
export default function LibraryView({ persons, groups, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const q = query.trim().toLowerCase();

  const switchTab = (next: Tab) => {
    setTab(next);
    // Keep the tab in the URL so back/refresh land on the same one.
    window.history.replaceState(
      null,
      "",
      next === "groups" ? "/library?tab=groups" : "/library",
    );
  };

  const shownPersons = persons
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.groups.some((g) => g.name.toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      sort === "most"
        ? b.entryCount - a.entryCount || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  const shownGroups = groups.filter((g) => g.name.toLowerCase().includes(q));

  const count = tab === "persons" ? persons.length : groups.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Library</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            {count}{" "}
            {tab === "persons"
              ? count === 1
                ? "person"
                : "persons"
              : count === 1
                ? "group"
                : "groups"}
          </p>
        </div>
        <Link href="/add" className="btn btn-secondary">
          <UserRoundPlus size={17} /> Add
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" className="flex rounded-md bg-surface-1 p-1">
          {(["persons", "groups"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={`flex-1 rounded-sm px-4 py-1.5 text-[14px] font-semibold capitalize transition sm:flex-none ${
                tab === t
                  ? "bg-surface-3 text-text"
                  : "text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              className="input !h-10 !pl-10"
              placeholder={
                tab === "persons" ? "Search persons or groups" : "Search groups"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {tab === "persons" && (
            <select
              className="input !h-10 !w-auto shrink-0 pr-8 text-[14px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort persons"
            >
              <option value="name">A–Z</option>
              <option value="most">Most logged</option>
            </select>
          )}
        </div>
      </div>

      {tab === "persons" ? (
        persons.length === 0 ? (
          <EmptyState
            title="Add your first person"
            sub="Persons can belong to groups and show up when you log."
            actionLabel="Add person"
            actionHref="/add"
          />
        ) : shownPersons.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">
            No persons match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <PersonGrid persons={shownPersons} />
        )
      ) : groups.length === 0 ? (
        <EmptyState
          title="Create your first group"
          sub="Groups keep members together, like a band or a cast."
          actionLabel="Create group"
          actionHref="/add"
        />
      ) : shownGroups.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">
          No groups match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shownGroups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="card flex items-center gap-3 p-3 transition hover:border-border-strong"
            >
              <Avatar
                src={g.photoUrl}
                name={g.name}
                size={52}
                shape="rounded"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">
                  {titleCase(g.name)}
                </span>
                <span className="block text-[13px] text-muted">
                  {g.persons.length} member{g.persons.length !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="flex -space-x-2">
                {g.persons.slice(0, 3).map((p) => (
                  <Avatar
                    key={p.id}
                    src={p.photoUrl}
                    name={p.name}
                    size={26}
                    className="ring-2 ring-surface-1"
                  />
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
