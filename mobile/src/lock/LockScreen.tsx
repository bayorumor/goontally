import { useEffect, useState } from "react";
import PinPad from "./PinPad";
import { checkPin } from "../local/lock";

const seconds = (ms: number) => Math.ceil(ms / 1000);

// Covers the whole app until the PIN is given. The app
// keeps running underneath, so it opens where it was left.
export default function LockScreen({
  blockedUntil,
  onUnlock,
}: {
  blockedUntil: number | null;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [waitUntil, setWaitUntil] = useState(blockedUntil ?? 0);
  const [now, setNow] = useState(() => Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const waiting = waitUntil > now;

  // Ticks the countdown while a pause runs.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [waiting]);

  const submit = async () => {
    setChecking(true);
    const result = await checkPin(pin);
    setChecking(false);
    setPin("");
    if (result.ok) return onUnlock();
    if (result.waitMs) {
      setWaitUntil(Date.now() + result.waitMs);
      setNow(Date.now());
      setError("Too many wrong PINs");
    } else
      setError(
        `Wrong PIN. ${result.triesLeft} more ${result.triesLeft === 1 ? "try" : "tries"} before a pause.`,
      );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Goontally is locked"
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-8 bg-bg px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      <div className="text-center">
        <p className="font-display text-[28px] font-bold tracking-tight">
          Goontally
        </p>
        <p className="mt-1 text-[14px] text-muted">
          {waiting
            ? `Try again in ${seconds(waitUntil - now)} s`
            : "Enter your PIN"}
        </p>
      </div>

      <PinPad
        value={pin}
        onChange={(value) => {
          setPin(value);
          setError("");
        }}
        onSubmit={submit}
        submitLabel={checking ? "Checking…" : "Unlock"}
        disabled={checking || waiting}
      />

      <div className="min-h-10 max-w-xs text-center">
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {showHelp ? (
          <p className="mt-2 text-[13px] text-subtle">
            A forgotten PIN can&apos;t be reset. Uninstall and reinstall the
            app, then restore a backup in Settings → Import backup.
          </p>
        ) : (
          <button
            type="button"
            className="mt-2 text-[13px] text-subtle underline"
            onClick={() => setShowHelp(true)}
          >
            Forgot your PIN?
          </button>
        )}
      </div>
    </div>
  );
}
