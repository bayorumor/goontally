import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { createBackup } from "../shims/backup-client";
import { db } from "./db";
import { writeBytes } from "./files";

// Automatic backups: when the app opens or comes back to the front and the
// last one is older than the schedule, a .gtbak goes to Documents/Goontally
// and only the newest few are kept. That folder outlives the app, so after
// a reinstall the files can be restored with Import backup.
//
// Checking on open is simpler and more reliable than background jobs,
// which Android postpones or kills to save battery.

export const BACKUP_FOLDER = "Goontally";
// Older automatic backups beyond this many are deleted.
export const KEEP_BACKUPS = 5;
const PREFIX = "goontally-auto-";

export type Frequency = "off" | "daily" | "weekly";

export interface AutoBackup {
  frequency: Frequency;
  includePhotos: boolean;
  // Locks every automatic backup when set. Kept in the app's private
  // database, so the phone can make backups without asking each time.
  password: string;
  lastAt: string | null;
  lastFile: string | null;
  lastError: string | null;
}

const KEY = "autoBackup";
const DEFAULTS: AutoBackup = {
  frequency: "off",
  includePhotos: true,
  password: "",
  lastAt: null,
  lastFile: null,
  lastError: null,
};
const INTERVAL_MS: Record<Frequency, number> = {
  off: Infinity,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export async function getAutoBackup(): Promise<AutoBackup> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [KEY],
  );
  return { ...DEFAULTS, ...(row ? JSON.parse(row.value) : {}) };
}

export async function saveAutoBackup(patch: Partial<AutoBackup>) {
  const next = { ...(await getAutoBackup()), ...patch };
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [KEY, JSON.stringify(next)],
  );
  return next;
}

// "goontally-auto-2026-10-25-2030.gtbak", in local time, so the names sort
// oldest to newest.
function fileName(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${PREFIX}${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.gtbak`;
}

let running: Promise<AutoBackup> | null = null;

// Makes a backup now, whatever the schedule. Failures are recorded in the
// settings for the Settings page to show, rather than thrown.
export function runAutoBackup(): Promise<AutoBackup> {
  running ??= (async () => {
    const settings = await getAutoBackup();
    try {
      if (Capacitor.isNativePlatform()) {
        const { publicStorage } = await Filesystem.checkPermissions();
        if (
          publicStorage !== "granted" &&
          (await Filesystem.requestPermissions()).publicStorage !== "granted"
        )
          throw new Error("Allow storage access to save automatic backups");
      }

      const { file } = await createBackup({
        includePhotos: settings.includePhotos,
        password: settings.password || undefined,
      });
      const now = new Date();
      const name = fileName(now);
      await writeBytes(Directory.Documents, `${BACKUP_FOLDER}/${name}`, file);
      await prune();
      return await saveAutoBackup({
        lastAt: now.toISOString(),
        lastFile: name,
        lastError: null,
      });
    } catch (err) {
      return await saveAutoBackup({
        lastError: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = null;
    }
  })();
  return running;
}

// Runs a backup when one is due by the schedule.
export async function runAutoBackupIfDue() {
  const { frequency, lastAt } = await getAutoBackup();
  if (frequency === "off") return;
  const since = lastAt ? Date.now() - Date.parse(lastAt) : Infinity;
  if (since >= INTERVAL_MS[frequency]) await runAutoBackup();
}

// Keeps the newest few automatic backups; files made by hand are left alone.
async function prune() {
  const { files } = await Filesystem.readdir({
    directory: Directory.Documents,
    path: BACKUP_FOLDER,
  });
  const ours = files
    .map((f) => f.name)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(".gtbak"))
    .sort()
    .reverse();
  for (const name of ours.slice(KEEP_BACKUPS))
    await Filesystem.deleteFile({
      directory: Directory.Documents,
      path: `${BACKUP_FOLDER}/${name}`,
    }).catch(() => {});
}
