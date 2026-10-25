"use client";

import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import Terms, { type TermsWhere } from "./Terms";

// Settings (Profile on the web) → Terms of Use: the same terms agreed to
// before first use.
export default function TermsCard({ where }: { where: TermsWhere }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">Terms of Use</h2>
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
        >
          <FileText size={18} className="text-muted" />
          <span className="flex-1 text-[15px] font-medium">Read the terms</span>
          <ChevronRight size={18} className="text-subtle" />
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Terms of Use">
        <Terms where={where} />
      </Sheet>
    </section>
  );
}
