import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import PinPad from "./PinPad";
import { checkPin, clearPin, PIN_MAX, PIN_MIN, setPin } from "../local/lock";

// Setting, changing or turning off the PIN. Changing and turning off ask for
// the current PIN first; a new PIN is typed twice.
export type PinAction = "set" | "change" | "off";

type Step = "current" | "new" | "confirm";

const TITLES: Record<PinAction, string> = {
  set: "Set a PIN",
  change: "Change PIN",
  off: "Turn off PIN",
};

export default function PinSheet({
  action,
  onClose,
  onDone,
}: {
  action: PinAction | null;
  onClose: () => void;
  onDone: (action: PinAction) => void;
}) {
  return action ? (
    // Keyed so each opening starts from the first step.
    <PinFlow key={action} action={action} onClose={onClose} onDone={onDone} />
  ) : null;
}

function PinFlow({
  action,
  onClose,
  onDone,
}: {
  action: PinAction;
  onClose: () => void;
  onDone: (action: PinAction) => void;
}) {
  const [step, setStep] = useState<Step>(action === "set" ? "new" : "current");
  const [value, setValue] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const prompt = {
    current: "Enter your current PIN",
    new: `Pick a new PIN, ${PIN_MIN} to ${PIN_MAX} digits`,
    confirm: "Type the new PIN again",
  }[step];

  const submit = async () => {
    setBusy(true);
    try {
      if (step === "current") {
        const result = await checkPin(value);
        if (!result.ok) {
          setError(
            result.waitMs
              ? `Too many wrong PINs. Try again in ${Math.ceil(result.waitMs / 1000)} s.`
              : "Wrong PIN",
          );
          return;
        }
        if (action === "off") {
          await clearPin();
          return onDone(action);
        }
        setStep("new");
      } else if (step === "new") {
        setFirst(value);
        setStep("confirm");
      } else {
        if (value !== first) {
          setError("The PINs don't match. Pick a new one again.");
          setStep("new");
          setFirst("");
          return;
        }
        await setPin(value);
        return onDone(action);
      }
      setError("");
    } finally {
      setValue("");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={() => !busy && onClose()} title={TITLES[action]}>
      <div className="flex flex-col items-center gap-5 pb-2 pt-2">
        <p className="text-center text-[14px] text-muted">{prompt}</p>
        <PinPad
          value={value}
          onChange={(v) => {
            setValue(v);
            setError("");
          }}
          onSubmit={submit}
          submitLabel={step === "confirm" || action === "off" ? "Done" : "Next"}
          disabled={busy}
        />
        <p className="min-h-5 text-center text-[13px] text-danger">{error}</p>
        {step === "new" && (
          <p className="text-center text-[13px] text-subtle">
            A forgotten PIN can&apos;t be recovered: keep a backup.
          </p>
        )}
      </div>
    </Sheet>
  );
}
