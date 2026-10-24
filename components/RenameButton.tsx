"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useFeedback } from "@/components/ui/Feedback";
import { NAME_MAX } from "@/lib/constants";

interface Props {
  // PATCH endpoint that accepts a multipart "name" field.
  endpoint: string;
  currentName: string;
  noun: string;
}

export default function RenameButton({ endpoint, currentName, noun }: Props) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = name.trim();
    if (!next) {
      setError("Enter a name");
      return;
    }
    if (next === currentName) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", next);
      const res = await fetch(endpoint, { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't rename");
        return;
      }
      setOpen(false);
      toast("Renamed");
      router.refresh();
    } catch {
      setError("Couldn't rename. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        className="icon-btn"
        aria-label={`Rename ${noun}`}
        onClick={() => {
          setName(currentName);
          setError("");
          setOpen(true);
        }}
      >
        <Pencil size={17} />
      </button>
      <Sheet
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={`Rename ${noun}`}
        footer={
          <button
            className="btn btn-primary btn-block"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      >
        <input
          className="input"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </Sheet>
    </>
  );
}
