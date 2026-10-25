"use client";

import { useState } from "react";
import { ChevronRight, Tags } from "lucide-react";
import OptionsSheet from "./OptionsSheet";

// Settings (Profile on the web) → Log options: the finishes and mediums
// offered when logging.
export default function OptionsCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">Log options</h2>
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
        >
          <Tags size={18} className="text-muted" />
          <span className="flex-1 text-[15px] font-medium">
            Finishes &amp; mediums
          </span>
          <ChevronRight size={18} className="text-subtle" />
        </button>
      </div>
      <OptionsSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
