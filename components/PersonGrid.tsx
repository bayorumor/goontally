import PersonCard from "@/components/PersonCard";
import { Person } from "@/lib/types";

// Shared by every card grid (persons, highlights) so they line up. Three
// columns on phones, six from tablets up: both divide six, so a set of six
// highlights never leaves a lone card on its own row.
export const CARD_GRID = "grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3";

// Grid of person cards, laid out by CARD_GRID.
export default function PersonGrid({
  persons,
  showCount = true,
  showGroups = true,
}: {
  persons: (Person & { entryCount?: number })[];
  showCount?: boolean;
  showGroups?: boolean;
}) {
  return (
    <div className={CARD_GRID}>
      {persons.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          showCount={showCount}
          showGroups={showGroups}
        />
      ))}
    </div>
  );
}
