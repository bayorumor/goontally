"use client";

import { ReactNode, useRef } from "react";
import { X } from "lucide-react";
import { useModalLayer } from "./useModalLayer";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // Pinned under the scrollable body, e.g. the primary action.
  footer?: ReactNode;
  // Wide sheets (the log form) get more room on desktop.
  size?: "md" | "lg";
}

// Bottom sheet on phones, centered dialog on wider screens.
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalLayer(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div
      className="animate-fade fixed inset-0 z-[300] flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-sheet outline-none flex max-h-[92dvh] w-full flex-col edge rounded-t-xl border border-border-strong bg-surface-2 sm:rounded-xl ${
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button
            className="icon-btn -mr-2"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {children}
        </div>
        {footer && (
          <div className="border-t border-border px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
