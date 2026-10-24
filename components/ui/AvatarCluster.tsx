import Avatar from "./Avatar";
import { PersonSummary } from "@/lib/types";

// Everything is laid out in a square box BOX avatar-widths wide. Four
// avatars sit in a 2×2 grid stepping by STEP, so neighbours overlap a little.
const STEP = 0.8;
const BOX = 1 + STEP;
// Two avatars are drawn larger, set on a diagonal.
const PAIR_SCALE = 1.2;
// The "+N" bubble that sits in the middle of the 2×2 grid for 5+ persons.
const MORE_SCALE = 0.62;

type Slot = { x: number; y: number; scale?: number };

// Top-left corner of each avatar, in avatar widths.
const LAYOUTS: Record<number, Slot[]> = {
  1: [{ x: STEP / 2, y: STEP / 2 }],
  // Diagonal: one up-left, one down-right.
  2: [
    { x: 0, y: 0, scale: PAIR_SCALE },
    { x: BOX - PAIR_SCALE, y: BOX - PAIR_SCALE, scale: PAIR_SCALE },
  ],
  // Triangle: one on top, two below.
  3: [
    { x: STEP / 2, y: 0 },
    { x: 0, y: STEP },
    { x: STEP, y: STEP },
  ],
  // Two rows of two.
  4: [
    { x: 0, y: 0 },
    { x: STEP, y: 0 },
    { x: 0, y: STEP },
    { x: STEP, y: STEP },
  ],
};

export default function AvatarCluster({
  persons,
  size,
}: {
  persons: PersonSummary[];
  size: number;
}) {
  // Five or more: the first four in the grid, the rest counted in a bubble.
  const shown = persons.slice(0, 4);
  const extra = persons.length - shown.length;
  const layout = LAYOUTS[shown.length] ?? LAYOUTS[1];
  const box = size * BOX;
  const more = size * MORE_SCALE;

  return (
    <div className="relative shrink-0" style={{ width: box, height: box }}>
      {shown.map((p, i) => {
        const { x, y, scale = 1 } = layout[i];
        return (
          <Avatar
            key={p.id}
            src={p.photoUrl}
            name={p.name}
            size={Math.round(size * scale)}
            className="absolute ring-[3px] ring-surface-1"
            style={{ left: x * size, top: y * size }}
          />
        );
      })}
      {extra > 0 && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-surface-3 font-semibold text-text ring-[3px] ring-surface-1"
          style={{
            width: more,
            height: more,
            left: (box - more) / 2,
            top: (box - more) / 2,
            fontSize: Math.max(11, more * 0.36),
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
