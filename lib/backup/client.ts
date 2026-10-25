import { packBackup, type Backup } from "./archive";
import { BACKUP_EXTENSION, makeManifest, PHOTO_TYPES, type BackupData } from "./format";
import type { ImportMode, ImportResult } from "./server";

// Browser half of backups on the web app: packs the rows from GET
// /api/backup with photos fetched straight from Cloudinary, and after an
// import uploads the backup's photos through the usual photo endpoints.
// Each request stays small this way, well under hosting body limits.

type Progress = (done: number, total: number) => void;

// Runs `work` over the items, a few at a time.
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const run = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

const extensionOf = (type: string) =>
  Object.entries(PHOTO_TYPES).find(([, t]) => t === type)?.[0];

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong, please try again");
  return body;
}

export async function createBackup(opts: {
  includePhotos: boolean;
  password?: string;
  onPhotos?: Progress;
}): Promise<{ file: Uint8Array; filename: string; missingPhotos: number }> {
  const rows: BackupData = await readJson(
    await fetch("/api/backup", { cache: "no-store" }),
  );

  // Photo URL → path in the zip; a photo that can't be fetched is left out.
  const urls = [
    ...new Set(
      [...rows.persons, ...rows.groups].flatMap((r) => (r.photo ? [r.photo] : [])),
    ),
  ];
  const paths = new Map<string, string>();
  const photos = new Map<string, Uint8Array>();
  if (opts.includePhotos) {
    let done = 0;
    opts.onPhotos?.(0, urls.length);
    await pool(urls, 4, async (url) => {
      try {
        const res = await fetch(url);
        const ext = extensionOf(res.headers.get("content-type") ?? "");
        if (res.ok && ext) {
          const path = `photos/${crypto.randomUUID()}.${ext}`;
          photos.set(path, new Uint8Array(await res.arrayBuffer()));
          paths.set(url, path);
        }
      } catch {
        // Counted as missing below.
      }
      opts.onPhotos?.(++done, urls.length);
    });
  }

  const withPaths = <T extends { photo: string | null }>(r: T) => ({
    ...r,
    photo: (r.photo && paths.get(r.photo)) ?? null,
  });
  const data: BackupData = {
    ...rows,
    persons: rows.persons.map(withPaths),
    groups: rows.groups.map(withPaths),
  };
  const backup: Backup = {
    manifest: makeManifest(data, "web", photos.size),
    data,
    photos,
  };

  const day = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  return {
    file: await packBackup(backup, opts.password || undefined),
    filename: `goontally-${day}${BACKUP_EXTENSION}`,
    missingPhotos: opts.includePhotos ? urls.length - photos.size : 0,
  };
}

export function saveFile(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Imports the rows, then uploads the photos the server asked for. Returns
// the server's summary and how many photos failed to upload.
export async function restoreBackup(
  backup: Backup,
  mode: ImportMode,
  onPhotos?: Progress,
): Promise<ImportResult & { failedPhotos: number }> {
  const result: ImportResult = await readJson(
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, data: backup.data }),
    }),
  );

  const uploads = result.photos.filter((p) => backup.photos.has(p.path));
  let done = 0;
  let failed = result.photos.length - uploads.length;
  onPhotos?.(0, uploads.length);
  await pool(uploads, 3, async ({ path, kind, id }) => {
    const ext = path.split(".").pop()!;
    const fd = new FormData();
    fd.append(
      "photo",
      new File([backup.photos.get(path)! as Uint8Array<ArrayBuffer>], path.slice(7), {
        type: PHOTO_TYPES[ext],
      }),
    );
    try {
      const res = await fetch(`/api/${kind}s/${id}`, { method: "PATCH", body: fd });
      if (!res.ok) failed++;
    } catch {
      failed++;
    }
    onPhotos?.(++done, uploads.length);
  });

  return { ...result, failedPhotos: failed };
}
