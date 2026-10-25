import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/ui/Feedback";
import {
  BACKUP_FOLDER,
  KEEP_BACKUPS,
  runAutoBackup,
  saveAutoBackup,
  type AutoBackup,
  type Frequency,
} from "../local/autoBackup";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Settings → Automatic backup: how often, what goes in, an optional
// password, and when the last one ran.
export default function AutoBackupCard({ settings }: { settings: AutoBackup }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [password, setPassword] = useState("");
  const [editingPassword, setEditingPassword] = useState(false);
  const [running, setRunning] = useState(false);

  const save = async (patch: Partial<AutoBackup>, message?: string) => {
    await saveAutoBackup(patch);
    if (message) toast(message);
    router.refresh();
  };

  const backUpNow = async () => {
    setRunning(true);
    const result = await runAutoBackup();
    setRunning(false);
    toast(
      result.lastError ? `Backup failed: ${result.lastError}` : "Backed up",
      result.lastError ? "error" : "info",
    );
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">Automatic backup</h2>
      <div className="card flex flex-col gap-5 p-4">
        <div>
          <span className="label">How often</span>
          <div className="chip-row">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                className="chip"
                aria-pressed={settings.frequency === f.value}
                onClick={() => save({ frequency: f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-subtle">
            Runs when you open the app and the last one is older than that. The
            newest {KEEP_BACKUPS} are kept in Documents/{BACKUP_FOLDER}, which
            stays on the phone even if the app is uninstalled. Restore them with
            Import backup.
          </p>
        </div>

        <div>
          <span className="label">Contents</span>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              aria-pressed={settings.includePhotos}
              onClick={() => save({ includePhotos: true })}
            >
              Data + images
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={!settings.includePhotos}
              onClick={() => save({ includePhotos: false })}
            >
              Data only
            </button>
          </div>
        </div>

        <div>
          <span className="label">Password (optional)</span>
          {editingPassword ? (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="password"
                autoFocus
                autoComplete="new-password"
                aria-label="Backup password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!password}
                onClick={async () => {
                  await save({ password }, "Password saved");
                  setPassword("");
                  setEditingPassword(false);
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-muted">
                {settings.password ? "Set" : "None"}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingPassword(true)}
              >
                {settings.password ? "Change" : "Set password"}
              </button>
              {settings.password && (
                <button
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => save({ password: "" }, "Password removed")}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          <p className="mt-2 text-[13px] text-subtle">
            {settings.password
              ? "Automatic backups need it to be opened. It can't be recovered, so keep it somewhere safe."
              : "Without one, anyone who can open the folder can read the backups."}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-[14px] text-muted">
            {settings.lastAt
              ? `Last backup: ${when(settings.lastAt)}`
              : "No automatic backup yet"}
          </p>
          {settings.lastError && (
            <p className="text-[13px] text-danger">
              Last try failed: {settings.lastError}
            </p>
          )}
          <button
            className="btn btn-secondary self-start"
            onClick={backUpNow}
            disabled={running}
          >
            {running ? "Backing up…" : "Back up now"}
          </button>
        </div>
      </div>
    </section>
  );
}
