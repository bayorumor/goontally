"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import Sheet from "./Sheet";

// App-wide toast messages and confirm dialogs, replacing the browser's
// alert() and confirm().

type ToastKind = "info" | "error";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const nextId = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3200,
    );
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Sheet
        open={!!pending}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        footer={
          <div className="flex gap-3">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => settle(false)}
            >
              Cancel
            </button>
            <button
              className={`btn flex-1 ${pending?.danger ? "btn-danger" : "btn-primary"}`}
              onClick={() => settle(true)}
              autoFocus
            >
              {pending?.confirmLabel}
            </button>
          </div>
        }
      >
        {pending?.message && (
          <p className="text-[14px] text-muted">{pending.message}</p>
        )}
      </Sheet>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+16px)] z-[400] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-sheet rounded-md border px-4 py-2.5 text-[14px] font-medium shadow-lg ${
              t.kind === "error"
                ? "border-danger/40 bg-surface-3 text-danger"
                : "border-border-strong bg-surface-3 text-text"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}
