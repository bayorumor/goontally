import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import { Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Backup } from "../../../lib/backup/archive";
import {
  createBackup as createWebBackup,
  saveFile as download,
} from "../../../lib/backup/client";
import { PHOTO_TYPES, type ImportMode } from "../../../lib/backup/format";
import { importRows, setPhotos } from "../local/backup";
import { writeBytes } from "../local/files";
import { savePhoto, type PhotoKind } from "../local/photos";

// Stands in for lib/backup/client in the Android app. Packing is the web
// app's code as it is (its fetch("/api/backup") reaches the phone's local
// API), but a WebView can't download, so the file goes to Android's share
// menu instead. Restoring writes straight to the phone's database and photo
// folder: the web app's way, uploading each photo as its own request, costs
// several trips to the native side per photo.

// Android pauses the app when the screen turns off, which would stall a
// long backup or import halfway; the screen stays on until it's done.
async function awake<T>(work: () => Promise<T>): Promise<T> {
  if (!Capacitor.isNativePlatform()) return work();
  await KeepAwake.keepAwake().catch(() => {});
  try {
    return await work();
  } finally {
    await KeepAwake.allowSleep().catch(() => {});
  }
}

export const createBackup = (opts: Parameters<typeof createWebBackup>[0]) =>
  awake(() => createWebBackup({ ...opts, app: "android" }));

// Same contract as the web app's restoreBackup. The backup was already
// checked when it was read (lib/backup/archive.ts).
export const restoreBackup = (
  backup: Backup,
  mode: ImportMode,
  onPhotos?: (done: number, total: number) => void,
) =>
  awake(async () => {
    const result = await importRows(backup.data, mode);

    const wanted = result.photos.filter((p) => backup.photos.has(p.path));
    let failedPhotos = result.photos.length - wanted.length;
    const saved: { kind: PhotoKind; id: number; photo: string }[] = [];
    onPhotos?.(0, wanted.length);
    for (const [i, { path, kind, id }] of wanted.entries()) {
      const type = PHOTO_TYPES[path.split(".").pop()!];
      const bytes = backup.photos.get(path)! as Uint8Array<ArrayBuffer>;
      try {
        saved.push({
          kind,
          id,
          photo: await savePhoto(new Blob([bytes], { type }), kind),
        });
      } catch {
        failedPhotos++;
      }
      onPhotos?.(i + 1, wanted.length);
    }
    await setPhotos(saved);

    return { ...result, failedPhotos };
  });

// Returns false when the share menu was closed without picking anything.
export async function saveFile(bytes: Uint8Array, filename: string) {
  if (!Capacitor.isNativePlatform()) return download(bytes, filename);

  const uri = await writeBytes(Directory.Cache, `exports/${filename}`, bytes);
  try {
    await Share.share({ title: filename, files: [uri] });
    return true;
  } catch (err) {
    // The plugin rejects with "Share canceled" when backed out of.
    if (String(err).toLowerCase().includes("cancel")) return false;
    throw err;
  }
}
