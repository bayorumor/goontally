import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App } from "@capacitor/app";
import Sheet from "@/components/ui/Sheet";
import TermsScreen from "@/components/terms/TermsScreen";
import LockScreen from "./LockScreen";
import PinSheet, { type PinAction } from "./PinSheet";
import {
  applyHideInRecents,
  getLock,
  saveLock,
  type LockSettings,
} from "../local/lock";
import { acceptDisclaimer, disclaimerAccepted } from "../local/disclaimer";

interface LockApi {
  settings: LockSettings;
  // Reads the settings again after Settings changed them.
  refresh: () => Promise<void>;
}

const LockContext = createContext<LockApi | null>(null);

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error("useLock must be used inside LockGate");
  return ctx;
}

// Wraps the whole app. The very first launch shows the disclaimer, which has
// to be accepted before anything else. With a PIN set, the app opens locked
// and locks again after enough time in the background. Without one, the
// first launch offers to set one.
export default function LockGate({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LockSettings | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [offer, setOffer] = useState(false);
  const [pinAction, setPinAction] = useState<PinAction | null>(null);
  const latest = useRef<LockSettings | null>(null);
  const pausedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const next = await getLock();
    latest.current = next;
    setSettings(next);
    await applyHideInRecents(next.hideInRecents);
  }, []);

  useEffect(() => {
    void Promise.all([getLock(), disclaimerAccepted()]).then(([first, ok]) => {
      latest.current = first;
      setAccepted(ok);
      setSettings(first);
      setLocked(!!first.pin);
      setOffer(!first.pin && !first.offered);
      void applyHideInRecents(first.hideInRecents);
    });
  }, []);

  // Locks again when the app comes back after long enough away.
  useEffect(() => {
    const listeners = [
      App.addListener("pause", () => {
        pausedAt.current = Date.now();
      }),
      App.addListener("resume", () => {
        const lock = latest.current;
        const away = Date.now() - (pausedAt.current ?? Date.now());
        if (lock?.pin && away >= lock.lockAfter * 1000) setLocked(true);
      }),
    ];
    return () => {
      for (const l of listeners) void l.then((h) => h.remove());
    };
  }, []);

  // Nothing shows until the settings are known, so a locked app never
  // flashes its content.
  if (!settings) return null;

  const dismissOffer = () => {
    setOffer(false);
    void saveLock({ offered: true }).then(refresh);
  };

  return (
    <LockContext.Provider value={{ settings, refresh }}>
      {children}

      {locked && settings.pin && (
        <LockScreen
          blockedUntil={settings.blockedUntil}
          onUnlock={() => {
            setLocked(false);
            void refresh();
          }}
        />
      )}

      {!accepted && (
        <TermsScreen
          where="phone"
          onAccept={async () => {
            await acceptDisclaimer();
            setAccepted(true);
          }}
        />
      )}

      <Sheet
        open={offer && accepted}
        onClose={dismissOffer}
        title="Lock Goontally with a PIN?"
        footer={
          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1" onClick={dismissOffer}>
              Not now
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => {
                dismissOffer();
                setPinAction("set");
              }}
            >
              Set a PIN
            </button>
          </div>
        }
      >
        <p className="text-[14px] text-muted">
          Anyone who opens the app will need it. You can change or turn it off
          any time in Settings.
        </p>
      </Sheet>

      <PinSheet
        action={pinAction}
        onClose={() => setPinAction(null)}
        onDone={() => {
          setPinAction(null);
          void refresh();
        }}
      />
    </LockContext.Provider>
  );
}
