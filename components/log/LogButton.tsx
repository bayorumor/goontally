"use client";

import { Plus } from "lucide-react";
import { Person } from "@/lib/types";
import { useQuickLog } from "./QuickLog";

// Opens the quick-log sheet, optionally with a person already picked.
export default function LogButton({
  label = "Log",
  person,
}: {
  label?: string;
  person?: Person;
}) {
  const { openLog } = useQuickLog();
  return (
    <button className="btn btn-primary" onClick={() => openLog(person)}>
      <Plus size={18} /> {label}
    </button>
  );
}
