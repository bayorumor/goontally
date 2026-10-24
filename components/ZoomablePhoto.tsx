"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Props {
  src: string;
  fullSrc: string;
  alt: string;
  className: string;
}

// Hero photo that opens the full-size image in a lightbox.
export default function ZoomablePhoto({ src, fullSrc, alt, className }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="animate-fade fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={fullSrc}
            alt={alt}
            className="max-h-full max-w-full rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="icon-btn absolute right-4 top-[max(16px,env(safe-area-inset-top))] bg-black/50 !text-white"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}
