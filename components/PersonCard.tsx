import Link from "next/link";
import { Person } from "@/lib/types";
import { thumb } from "@/lib/image";

interface Props {
  person: Person & { entryCount?: number };
  showCount?: boolean;
  showGroups?: boolean;
}

// Portrait photo card linking to the person's page.
export default function PersonCard({
  person,
  showCount = true,
  showGroups = true,
}: Props) {
  const groups = person.groups.map((g) => g.name).join(" · ");

  return (
    <Link
      href={`/persons/${person.id}`}
      // clip-path keeps the corners round while the photo zooms on hover;
      // overflow-hidden alone lets the scaling layer flash square corners.
      className="group relative block aspect-[11/16] overflow-hidden rounded-lg border border-border bg-surface-1 transition [clip-path:inset(0_round_var(--r-lg))] hover:border-border-strong"
    >
      {person.photoUrl ? (
        <img
          src={thumb(person.photoUrl, 200)}
          alt={person.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-surface-2 text-[32px] font-bold text-subtle">
          {person.name.charAt(0).toUpperCase()}
        </span>
      )}

      {showCount && person.entryCount !== undefined && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-px text-[11px] font-semibold text-white sm:right-2 sm:top-2 sm:px-2 sm:py-0.5 sm:text-[12px]">
          {person.entryCount}
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-1.5 pt-8 sm:px-2.5 sm:pb-2">
        <span className="block truncate font-display text-[13px] font-semibold text-white sm:text-[14px]">
          {person.name}
        </span>
        {showGroups && (
          <span className="block truncate text-[10px] font-medium text-white/65 sm:text-[11px]">
            {groups || "Ungrouped"}
          </span>
        )}
      </span>
    </Link>
  );
}
