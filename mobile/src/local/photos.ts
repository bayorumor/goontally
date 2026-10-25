import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

// Photos live in the app's private folder (files/photos/<uuid>.jpg). Android
// doesn't scan it, so they never show up in the Gallery, and they go away
// with the app. The database stores only the file name.
//
// They're resized the way Cloudinary does it on the web: person photos to at
// most 800px wide, group photos to a 400px square.

const DIR = "photos";
const native = Capacitor.isNativePlatform();

export type PhotoKind = "person" | "group";

// Where the folder is, as a URL the WebView can load (native only).
let baseUrl = "";
// In the browser (dev server) files can't be loaded by URL, so they're
// read once into object URLs.
const devUrls = new Map<string, string>();

export async function initPhotos() {
  // Made up front: two first writes creating it at once would clash.
  await Filesystem.mkdir({
    directory: Directory.Data,
    path: DIR,
    recursive: true,
  }).catch(() => {}); // already there
  if (native) {
    const { uri } = await Filesystem.getUri({
      directory: Directory.Data,
      path: DIR,
    });
    baseUrl = Capacitor.convertFileSrc(uri);
    return;
  }
  try {
    const { files } = await Filesystem.readdir({
      directory: Directory.Data,
      path: DIR,
    });
    for (const f of files) devUrls.set(f.name, await readDevUrl(f.name));
  } catch {
    // No photos saved yet.
  }
}

async function readDevUrl(name: string) {
  const { data } = await Filesystem.readFile({
    directory: Directory.Data,
    path: `${DIR}/${name}`,
  });
  const blob =
    typeof data === "string"
      ? await (await fetch(`data:image/jpeg;base64,${data}`)).blob()
      : data;
  return URL.createObjectURL(blob);
}

// What an <img> needs to show a stored photo.
export function photoSrc(name: string | null): string | null {
  if (!name) return null;
  return native ? `${baseUrl}/${name}` : (devUrls.get(name) ?? null);
}

// Resizes and stores a photo; returns its file name for the database.
export async function savePhoto(file: Blob, kind: PhotoKind): Promise<string> {
  // A JPEG that's already the right size (photos from a backup always are)
  // is stored as it is: decoding and compressing it again is slow on a
  // phone and loses a little quality each time.
  const jpeg = fitsAlready(await jpegSize(file), kind)
    ? file
    : await resize(file, kind);
  const name = `${crypto.randomUUID()}.jpg`;
  await Filesystem.writeFile({
    directory: Directory.Data,
    path: `${DIR}/${name}`,
    data: await toBase64(jpeg),
    recursive: true,
  });
  if (!native) devUrls.set(name, URL.createObjectURL(jpeg));
  return name;
}

// Best-effort, like deleting from Cloudinary: a leftover file only costs
// space.
export async function deletePhoto(name: string | null) {
  if (!name) return;
  await Filesystem.deleteFile({
    directory: Directory.Data,
    path: `${DIR}/${name}`,
  }).catch(() => {});
  const url = devUrls.get(name);
  if (url) URL.revokeObjectURL(url);
  devUrls.delete(name);
}

function fitsAlready(
  size: { width: number; height: number } | null,
  kind: PhotoKind,
) {
  if (!size) return false;
  return kind === "group"
    ? size.width === size.height && size.width <= 400
    : size.width <= 800;
}

// Width and height from a JPEG's header (its SOF segment), or null when the
// file isn't a JPEG. Reads only the start of the file; nothing is decoded.
async function jpegSize(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    // SOF0–SOF15, minus DHT (C4), JPG (C8) and DAC (CC), which share the range.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    )
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    i += 2 + length;
  }
  return null;
}

async function resize(file: Blob, kind: PhotoKind): Promise<Blob> {
  const image = await createImageBitmap(file);
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  let w: number;
  let h: number;
  if (kind === "group") {
    // Center square, at most 400px.
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
    w = h = Math.min(side, 400);
  } else {
    const scale = Math.min(1, 800 / sw);
    w = Math.round(sw * scale);
    h = Math.round(sh * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  image.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't process the image")),
      "image/jpeg",
      0.85,
    ),
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
