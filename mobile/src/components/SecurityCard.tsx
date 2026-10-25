import { useEffect, useState } from "react";
import { useFeedback } from "@/components/ui/Feedback";
import PinSheet, { type PinAction } from "../lock/PinSheet";
import { useLock } from "../lock/LockGate";
import {
  hideInRecentsSupported,
  LOCK_AFTER,
  saveLock,
  type LockSettings,
} from "../local/lock";

const LOCK_AFTER_LABEL: Record<LockSettings["lockAfter"], string> = {
  0: "Right away",
  60: "1 min",
  300: "5 min",
  900: "15 min",
};

const DONE: Record<PinAction, string> = {
  set: "PIN set",
  change: "PIN changed",
  off: "PIN turned off",
};

// Settings → Security: the PIN, when to lock again, and
// hiding the app in recent apps.
export default function SecurityCard() {
  const { settings, refresh } = useLock();
  const { toast } = useFeedback();
  const [pinAction, setPinAction] = useState<PinAction | null>(null);
  const [canHide, setCanHide] = useState(false);
  const hasPin = !!settings.pin;

  useEffect(() => {
    void hideInRecentsSupported().then(setCanHide);
  }, []);

  const save = async (patch: Partial<LockSettings>) => {
    await saveLock(patch);
    await refresh();
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">Security</h2>
      <div className="card flex flex-col gap-5 p-4">
        <div>
          <span className="label">PIN lock</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] text-muted">
              {hasPin ? "On" : "Off"}
            </span>
            {hasPin ? (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPinAction("change")}
                >
                  Change PIN
                </button>
                <button
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => setPinAction("off")}
                >
                  Turn off
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setPinAction("set")}
              >
                Set a PIN
              </button>
            )}
          </div>
          <p className="mt-2 text-[13px] text-subtle">
            Asked whenever the app opens. A forgotten PIN can&apos;t be reset:
            reinstalling and restoring a backup is the only way back in.
          </p>
        </div>

        {hasPin && (
          <>
            <div>
              <span className="label">Lock again after leaving the app</span>
              <div className="chip-row">
                {LOCK_AFTER.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className="chip"
                    aria-pressed={settings.lockAfter === seconds}
                    onClick={() => save({ lockAfter: seconds })}
                  >
                    {LOCK_AFTER_LABEL[seconds]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-subtle">
                Picking a file or sharing a backup also leaves the app for a
                moment; with &quot;Right away&quot; it locks after those too.
              </p>
            </div>
          </>
        )}

        <div>
          <span className="label">Hide in recent apps</span>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              aria-pressed={settings.hideInRecents}
              disabled={!canHide}
              onClick={() => save({ hideInRecents: true })}
            >
              On
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={!settings.hideInRecents}
              onClick={() => save({ hideInRecents: false })}
            >
              Off
            </button>
          </div>
          <p className="mt-2 text-[13px] text-subtle">
            {canHide
              ? "The recent apps screen shows a blank card instead of what's on screen. Screenshots still work."
              : "Needs Android 13 or newer."}
          </p>
        </div>
      </div>

      <PinSheet
        action={pinAction}
        onClose={() => setPinAction(null)}
        onDone={async (action) => {
          setPinAction(null);
          await refresh();
          toast(DONE[action]);
        }}
      />
    </section>
  );
}
