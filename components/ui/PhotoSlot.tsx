"use client";

import { ImageUp } from "lucide-react";
import { useObjectUrl } from "@/lib/useObjectUrl";

const SHAPES = {
  // Person photos are portrait cards; groups and avatars are square.
  portrait: "h-16 w-11 rounded-md",
  square: "h-11 w-11 rounded-md",
  circle: "h-11 w-11 rounded-full",
};

// Photo picker for something not saved yet: shows the picked photo, or an
// "add photo" affordance shaped like the photo it will become.
export default function PhotoSlot({
  file,
  onPick,
  label,
  shape = "circle",
}: {
  file: File | null;
  onPick: (file: File) => void;
  // What the photo is for, e.g. "Add a photo of Alex".
  label: string;
  shape?: keyof typeof SHAPES;
}) {
  const preview = useObjectUrl(file);
  return (
    <label
      className={`relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border-strong bg-surface-2 text-muted hover:text-text ${SHAPES[shape]}`}
      title={label}
      aria-label={label}
    >
      {preview ? (
        <img src={preview} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageUp size={17} />
      )}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = "";
        }}
      />
    </label>
  );
}
