"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Upload } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useFeedback } from "@/components/ui/Feedback";
import { BackupError, isEncrypted, readBackup, type Backup } from "@/lib/backup/archive";
import { createBackup, restoreBackup, saveFile } from "@/lib/backup/client";
import { BACKUP_EXTENSION } from "@/lib/backup/format";
import type { ImportMode } from "@/lib/backup/format";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const message = (err: unknown) =>
  err instanceof BackupError || err instanceof Error
    ? err.message
    : "Something went wrong, please try again";

// Profile → Backup: export everything to a .gtbak file, or import one. The
// same file opens in the Android app.
//
// `anyFile` lists every file when picking one to import. Android's picker
// filters by file type, knows nothing of .gtbak, and would show nothing; the
// file is checked once picked anyway.
export default function BackupCard({ anyFile = false }: { anyFile?: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label px-1">Backup</h2>
      <div className="card divide-y divide-border overflow-hidden">
        <ExportRow />
        <ImportRow anyFile={anyFile} />
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
    >
      <Icon size={18} className="text-muted" />
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      <ChevronRight size={18} className="text-subtle" />
    </button>
  );
}

function ExportRow() {
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const busy = !!status;

  const run = async () => {
    if (password && password !== repeat) {
      setError("The passwords don't match");
      return;
    }
    setError("");
    setStatus("Preparing…");
    try {
      const { file, filename, missingPhotos } = await createBackup({
        includePhotos,
        password,
        onPhotos: (done, total) =>
          setStatus(total ? `Fetching images ${done}/${total}…` : "Packing…"),
      });
      if (!(await saveFile(file, filename))) return;
      setOpen(false);
      toast(
        missingPhotos
          ? `Backup saved, but ${plural(missingPhotos, "image")} couldn't be fetched`
          : "Backup saved",
        missingPhotos ? "error" : "info",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setStatus("");
    }
  };

  return (
    <>
      <Row
        icon={Download}
        label="Export backup"
        onClick={() => {
          setPassword("");
          setRepeat("");
          setError("");
          setOpen(true);
        }}
      />
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Export backup"
        footer={
          <button className="btn btn-primary btn-block" onClick={run} disabled={busy}>
            {status || "Export"}
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-muted">
            Saves your persons, groups, entries and options to one{" "}
            {BACKUP_EXTENSION} file. It opens in both the web app and the Android app.
          </p>

          <div>
            <span className="label">Contents</span>
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                aria-pressed={includePhotos}
                onClick={() => setIncludePhotos(true)}
              >
                Data + images
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={!includePhotos}
                onClick={() => setIncludePhotos(false)}
              >
                Data only
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="backup-password">
              Password (optional)
            </label>
            <input
              id="backup-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
            {password && (
              <input
                className="input mt-2"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                aria-label="Repeat password"
                value={repeat}
                onChange={(e) => {
                  setRepeat(e.target.value);
                  setError("");
                }}
              />
            )}
            <p className="mt-2 text-[13px] text-subtle">
              {password
                ? "The file can't be opened without it, and it can't be recovered."
                : "Without one, anyone who gets the file can read it."}
            </p>
          </div>

          {busy && <KeepOpen />}
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}

type ImportStep =
  | { kind: "password"; file: Uint8Array }
  | { kind: "summary"; backup: Backup };

function ImportRow({ anyFile }: { anyFile: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep | null>(null);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const busy = !!status;

  const open = async (file: Uint8Array, pw?: string) => {
    setError("");
    setStatus("Opening…");
    try {
      const backup = await readBackup(file, pw);
      setMode("merge");
      setStep({ kind: "summary", backup });
    } catch (err) {
      if (!step) toast(message(err), "error");
      else setError(message(err));
    } finally {
      setStatus("");
    }
  };

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    const file = new Uint8Array(await picked.arrayBuffer());
    setPassword("");
    if (isEncrypted(file)) setStep({ kind: "password", file });
    else open(file);
  };

  const run = async (backup: Backup) => {
    if (
      mode === "replace" &&
      !(await confirm({
        title: "Replace everything?",
        message:
          "Your current persons, groups, entries and options are deleted first, and can't be brought back.",
        confirmLabel: "Replace",
        danger: true,
      }))
    )
      return;

    setError("");
    setStatus("Importing…");
    try {
      const result = await restoreBackup(backup, mode, (done, total) => {
        if (total) setStatus(`Adding images ${done}/${total}…`);
      });
      setStep(null);
      router.refresh();
      const { added, skippedEntries, failedPhotos } = result;
      const parts = [
        plural(added.persons, "person"),
        plural(added.groups, "group"),
        plural(added.entries, "entry", "entries"),
      ];
      toast(
        failedPhotos
          ? `Imported, but ${plural(failedPhotos, "image")} couldn't be added`
          : `Added ${parts.join(", ")}${skippedEntries ? ` (${skippedEntries} already there)` : ""}`,
        failedPhotos ? "error" : "info",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setStatus("");
    }
  };

  const close = () => !busy && setStep(null);

  return (
    <>
      <Row icon={Upload} label="Import backup" onClick={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept={anyFile ? undefined : BACKUP_EXTENSION}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Sheet
        open={step?.kind === "password"}
        onClose={close}
        title="Backup password"
        footer={
          <button
            className="btn btn-primary btn-block"
            disabled={busy || !password}
            onClick={() => step?.kind === "password" && open(step.file, password)}
          >
            {status || "Open"}
          </button>
        }
      >
        <input
          className="input"
          type="password"
          autoFocus
          aria-label="Backup password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password && step?.kind === "password")
              open(step.file, password);
          }}
        />
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </Sheet>

      <Sheet
        open={step?.kind === "summary"}
        onClose={close}
        title="Import backup"
        footer={
          step?.kind === "summary" && (
            <button
              className={`btn btn-block ${mode === "replace" ? "btn-danger" : "btn-primary"}`}
              disabled={busy}
              onClick={() => run(step.backup)}
            >
              {status || (mode === "replace" ? "Replace and import" : "Import")}
            </button>
          )
        }
      >
        {step?.kind === "summary" && (
          <Summary backup={step.backup} mode={mode} onMode={setMode} busy={busy} />
        )}
        {busy && step?.kind === "summary" && (
          <div className="mt-3">
            <KeepOpen />
          </div>
        )}
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </Sheet>
    </>
  );
}

// Leaving partway is safe (see lib/backup), but it stops the work.
function KeepOpen() {
  return (
    <p className="text-[13px] text-muted">
      Keep this open until it finishes.
    </p>
  );
}

function Summary({
  backup,
  mode,
  onMode,
  busy,
}: {
  backup: Backup;
  mode: ImportMode;
  onMode: (mode: ImportMode) => void;
  busy: boolean;
}) {
  const { counts, createdAt, app } = backup.manifest;
  const made = new Date(createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const rows = [
    ["Persons", counts.persons],
    ["Groups", counts.groups],
    ["Entries", counts.entries],
    ["Images", backup.photos.size],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[14px] text-muted">
          Made {made} in the {app === "android" ? "Android app" : "web app"}.
        </p>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {rows.map(([label, n]) => (
            <div key={label} className="rounded-md bg-surface-3 px-1 py-2.5">
              <dt className="text-[12px] text-subtle">{label}</dt>
              <dd className="text-[17px] font-semibold tabular-nums">
                {n.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <span className="label">How to import</span>
        <div className="chip-row">
          <button
            type="button"
            className="chip"
            aria-pressed={mode === "merge"}
            disabled={busy}
            onClick={() => onMode("merge")}
          >
            Merge
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={mode === "replace"}
            disabled={busy}
            onClick={() => onMode("replace")}
          >
            Replace everything
          </button>
        </div>
        <p className="mt-2 text-[13px] text-subtle">
          {mode === "merge"
            ? "Adds what's missing. Persons and groups with the same name count as the same, and entries already here are skipped."
            : "Deletes everything here first, then imports the backup. Use this for a fresh start."}
        </p>
      </div>
    </div>
  );
}
