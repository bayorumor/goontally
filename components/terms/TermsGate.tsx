"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TermsScreen from "./TermsScreen";
import { useFeedback } from "@/components/ui/Feedback";

// Web: covers the app with the terms until the account has agreed to them,
// once. The answer is saved to the account, so it isn't asked again on
// other devices.
export default function TermsGate({ needed }: { needed: boolean }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [accepted, setAccepted] = useState(false);
  if (!needed || accepted) return null;

  return (
    <TermsScreen
      where="web"
      onAccept={async () => {
        const res = await fetch("/api/profile/terms", { method: "POST" }).catch(
          () => null,
        );
        if (!res?.ok) {
          toast("Couldn't save that. Check your connection.", "error");
          return false;
        }
        setAccepted(true);
        router.refresh();
      }}
    />
  );
}
