"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";

interface Props {
  endpoint: string;
  confirmTitle: string;
  confirmMessage: string;
  redirectTo: string;
  label: string;
}

export default function DeleteButton({
  endpoint,
  confirmTitle,
  confirmMessage,
  redirectTo,
  label,
}: Props) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const ok = await confirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        toast("Deleted");
        router.push(redirectTo);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast(data.error || "Couldn't delete", "error");
    } catch {
      toast("Couldn't delete. Check your connection.", "error");
    }
    setDeleting(false);
  };

  return (
    <button
      className="btn btn-ghost text-danger hover:!text-danger"
      onClick={handleDelete}
      disabled={deleting}
    >
      <Trash2 size={16} /> {deleting ? "Deleting…" : label}
    </button>
  );
}
