import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import {
  backupDataSchema,
  checkReferences,
  DATA_FILE,
  MANIFEST_FILE,
  manifestSchema,
  PHOTO_PATH,
  photoPaths,
  BACKUP_VERSION,
  type BackupData,
  type BackupManifest,
} from "./format";

// Packing and reading .gtbak files. Uses only fflate and WebCrypto, which
// browsers, Node and the Android WebView all have.
//
// A password-protected file is the whole zip encrypted with AES-256-GCM,
// keyed from the password with PBKDF2-SHA256:
//   "GTBAKENC" | version (1 byte) | iterations (uint32 BE) | salt (16) | iv (12) | ciphertext
// The header is authenticated too, so tampering with it fails like a wrong
// password does.

const MAGIC = strToU8("GTBAKENC");
const ENC_VERSION = 1;
const ITERATIONS = 600_000;
const HEADER_BYTES = MAGIC.length + 1 + 4 + 16 + 12;
// Refuse absurd iteration counts from a crafted header.
const MAX_ITERATIONS = 5_000_000;

// Limits while unzipping, so a crafted file can't exhaust memory.
const MAX_DATA_BYTES = 64 * 1024 * 1024;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export class BackupError extends Error {}

export interface Backup {
  manifest: BackupManifest;
  data: BackupData;
  // Photo bytes by path, e.g. "photos/3f9c….jpg".
  photos: Map<string, Uint8Array>;
}

export function isEncrypted(file: Uint8Array) {
  return MAGIC.every((b, i) => file[i] === b);
}

export async function packBackup(
  backup: Backup,
  password?: string,
): Promise<Uint8Array> {
  const files: Zippable = {
    [MANIFEST_FILE]: strToU8(JSON.stringify(backup.manifest, null, 2)),
    [DATA_FILE]: strToU8(JSON.stringify(backup.data)),
  };
  // Photos are already compressed; storing them as-is is much faster.
  for (const [path, bytes] of backup.photos) files[path] = [bytes, { level: 0 }];

  const zip = zipSync(files, { level: 6 });
  return password ? encrypt(zip, password) : zip;
}

// Throws BackupError with a message fit to show when the file is unusable.
export async function readBackup(
  file: Uint8Array,
  password?: string,
): Promise<Backup> {
  const zip = isEncrypted(file) ? await decrypt(file, password ?? "") : file;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, {
      filter: (f) =>
        f.name === MANIFEST_FILE || f.name === DATA_FILE
          ? f.originalSize <= MAX_DATA_BYTES
          : PHOTO_PATH.test(f.name) && f.originalSize <= MAX_PHOTO_BYTES,
    });
  } catch {
    throw new BackupError("This isn't a Goontally backup file");
  }

  const manifest = manifestSchema.safeParse(parseJson(entries[MANIFEST_FILE]));
  if (!manifest.success)
    throw new BackupError("This isn't a Goontally backup file");
  if (manifest.data.version > BACKUP_VERSION)
    throw new BackupError("This backup is from a newer version of the app");

  const data = backupDataSchema.safeParse(parseJson(entries[DATA_FILE]));
  if (!data.success) throw new BackupError("The backup's data is damaged");
  const broken = checkReferences(data.data);
  if (broken) throw new BackupError(`The backup's data is damaged: ${broken}`);

  // A photo that's missing from the zip just leaves its row without one.
  const photos = new Map<string, Uint8Array>();
  for (const path of photoPaths(data.data))
    if (entries[path]) photos.set(path, entries[path]);

  return { manifest: manifest.data, data: data.data, photos };
}

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return null;
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return null;
  }
}

// WebCrypto wants ArrayBuffer-backed views; fflate's are, but TypeScript
// can't tell, so they're narrowed here.
const buf = (u8: Uint8Array) => u8 as Uint8Array<ArrayBuffer>;

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey(
    "raw",
    buf(strToU8(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(plain: Uint8Array, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  header[MAGIC.length] = ENC_VERSION;
  new DataView(header.buffer).setUint32(MAGIC.length + 1, ITERATIONS);
  header.set(salt, MAGIC.length + 5);
  header.set(iv, MAGIC.length + 21);

  const key = await deriveKey(password, salt, ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header },
    key,
    buf(plain),
  );
  const out = new Uint8Array(HEADER_BYTES + cipher.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(cipher), HEADER_BYTES);
  return out;
}

async function decrypt(file: Uint8Array, password: string) {
  if (!password) throw new BackupError("This backup needs its password");
  if (file.length < HEADER_BYTES || file[MAGIC.length] !== ENC_VERSION)
    throw new BackupError("This backup is from a newer version of the app");

  const header = file.slice(0, HEADER_BYTES);
  const iterations = new DataView(header.buffer).getUint32(MAGIC.length + 1);
  if (iterations < 1 || iterations > MAX_ITERATIONS)
    throw new BackupError("This isn't a Goontally backup file");
  const salt = header.slice(MAGIC.length + 5, MAGIC.length + 21);
  const iv = header.slice(MAGIC.length + 21, HEADER_BYTES);

  const key = await deriveKey(password, salt, iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: header },
      key,
      buf(file.subarray(HEADER_BYTES)),
    );
    return new Uint8Array(plain);
  } catch {
    throw new BackupError("Wrong password, or the file is damaged");
  }
}
