"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundMinus } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import Avatar from "@/components/ui/Avatar";
import { useFeedback } from "@/components/ui/Feedback";
import type { PersonSummary } from "@/lib/types";

// A group page's "Remove members": a list of members, each with a Remove
// button. Removing only ends the membership; the person, their entries and
// the group stay. "Add members" brings someone back.
export default function RemoveMembersButton({
  groupId,
  members,
}: {
  groupId: number;
  members: PersonSummary[];
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  // Hidden right away, before the page's data comes back without them.
  const [removed, setRemoved] = useState<number[]>([]);
  const shown = members.filter((m) => !removed.includes(m.id));

  const remove = async (member: PersonSummary) => {
    setRemoving(member.id);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/members/${member.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Couldn't remove them", "error");
        return;
      }
      setRemoved((prev) => [...prev, member.id]);
      toast(`${member.name} removed from the group`);
      router.refresh();
    } catch {
      toast("Couldn't remove them. Check your connection.", "error");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={() => {
          setRemoved([]);
          setOpen(true);
        }}
      >
        <UserRoundMinus size={17} /> Remove members
      </button>
      <Sheet
        open={open}
        onClose={() => removing === null && setOpen(false)}
        title="Remove members"
      >
        <p className="text-[13px] text-subtle">
          They stay in your library with all their entries; only the group
          membership ends.
        </p>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">
            No members left.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shown.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar src={m.photoUrl} name={m.name} size={36} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {m.name}
                </span>
                <button
                  className="btn btn-secondary btn-sm shrink-0"
                  onClick={() => remove(m)}
                  disabled={removing !== null}
                >
                  {removing === m.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
