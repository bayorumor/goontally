"use client";

import { useState } from "react";
import Terms, { type TermsWhere } from "./Terms";

// Shown once before first use: the terms of use, full screen. There's no
// way past it but agreeing; Settings (Profile on the web) keeps a copy to
// reread.
export default function TermsScreen({
  where,
  onAccept,
}: {
  where: TermsWhere;
  // May resolve to false when saving the answer failed, to try again.
  onAccept: () => Promise<boolean | void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Before you start"
      className="fixed inset-0 z-[1100] flex flex-col bg-bg pb-[max(16px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pt-10">
        <p className="font-display text-[28px] font-bold tracking-tight">
          Before you start
        </p>
        <div className="mt-6">
          <Terms where={where} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-6 pt-4">
        <button
          className="btn btn-primary btn-block"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            if ((await onAccept()) === false) setSaving(false);
          }}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
