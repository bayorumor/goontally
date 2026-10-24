import { thumb } from "@/lib/image";

// A heavily blurred, dimmed copy of a photo behind a page's hero, so each
// person or group page picks up its own colours. Faded out on every side by
// an elliptical mask that reaches full transparency exactly at the left,
// right and bottom edges, so it never shows a hard edge. Needs a `relative
// isolate` parent.
export default function AmbientBackdrop({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-4 -top-5 -z-10 h-[420px] overflow-hidden md:-inset-x-6 md:-top-8"
      style={{
        maskImage:
          "radial-gradient(ellipse 50% 100% at 50% 0%, black 15%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 50% 100% at 50% 0%, black 15%, transparent 100%)",
      }}
    >
      {/* A tiny thumbnail is plenty once it's this blurred. */}
      <img
        src={thumb(src, 60)}
        alt=""
        className="h-full w-full scale-125 object-cover opacity-45 blur-3xl saturate-150"
      />
    </div>
  );
}
