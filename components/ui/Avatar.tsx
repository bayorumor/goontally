import { thumb } from "@/lib/image";
import { titleCase } from "@/lib/format";

interface Props {
  src: string | null | undefined;
  name: string;
  size: number;
  // circle: people/avatars, rounded: groups in lists, portrait: person cards.
  shape?: "circle" | "rounded";
  className?: string;
  // Extra inline styles, e.g. absolute positioning inside an AvatarCluster.
  style?: React.CSSProperties;
}

// Photo thumbnail with an initial-letter fallback. Always square, so it can
// never render squashed.
export default function Avatar({
  src,
  name,
  size,
  shape = "circle",
  className = "",
  style,
}: Props) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-md";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-surface-3 font-semibold text-muted ${radius} ${className}`}
      style={{
        ...style,
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.4),
      }}
    >
      {src ? (
        <img
          src={thumb(src, size, { square: true })}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        titleCase(name).charAt(0) || "?"
      )}
    </span>
  );
}
