import { useEffect, useState } from "react";
import { useFeedback } from "@/components/ui/Feedback";
import {
  APP_VERSION,
  checkForUpdate,
  getUpdates,
  openExternal,
  RELEASES_URL,
  saveUpdates,
  UPDATES_CHANGED,
  type UpdateSettings,
} from "../local/updates";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Settings → About: the version, and the update check.
export default function AboutCard() {
  const { toast } = useFeedback();
  const [updates, setUpdates] = useState<UpdateSettings | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const load = () => void getUpdates().then(setUpdates);
    load();
    window.addEventListener(UPDATES_CHANGED, load);
    return () => window.removeEventListener(UPDATES_CHANGED, load);
  }, []);

  const checkNow = async () => {
    setChecking(true);
    try {
      const release = await checkForUpdate();
      // A banner closed earlier comes back when asked for.
      if (release) await saveUpdates({ dismissed: null });
      toast(
        release
          ? `Goontally ${release.version} is available`
          : "You have the newest version",
      );
    } catch {
      toast("Couldn't reach GitHub. Check your connection.", "error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">About</h2>
      <div className="card flex flex-col gap-5 p-4">
        <p className="text-[14px]">
          Goontally <span className="tabular-nums">{APP_VERSION}</span>
        </p>

        {updates && (
          <div>
            <span className="label">Check for updates automatically</span>
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                aria-pressed={updates.auto}
                onClick={() => void saveUpdates({ auto: true })}
              >
                On
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={!updates.auto}
                onClick={() => void saveUpdates({ auto: false })}
              >
                Off
              </button>
            </div>
            <p className="mt-2 text-[13px] text-subtle">
              Once a day, the app asks GitHub whether a newer version is out.
              That&apos;s the only time it goes online; with this off, it never
              does.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {updates?.lastCheckAt && (
            <p className="text-[14px] text-muted">
              Last checked: {when(updates.lastCheckAt)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary"
              onClick={checkNow}
              disabled={checking}
            >
              {checking ? "Checking…" : "Check now"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => openExternal(RELEASES_URL)}
            >
              All releases
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
