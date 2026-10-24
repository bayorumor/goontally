import { CARD_GRID } from "@/components/PersonGrid";

// Shown while a page's server data loads. Mirrors the title + card grid most
// pages lead with.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-32" />
      </div>
      <div className={CARD_GRID}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[11/16] !rounded-lg" />
        ))}
      </div>
    </div>
  );
}
