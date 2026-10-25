import { Directory, Filesystem } from "@capacitor/filesystem";

// Writes bytes to a file a slice at a time. The plugin takes base64 text,
// and one big string for a backup with photos is slow to pass to Android
// and can run out of memory. Each slice is a multiple of 3 bytes, so the
// base64 pieces decode back exactly.
const SLICE = 3 * 256 * 1024;

export async function writeBytes(
  directory: Directory,
  path: string,
  bytes: Uint8Array,
) {
  for (let i = 0; i < Math.max(bytes.length, 1); i += SLICE) {
    const data = toBase64(bytes.subarray(i, i + SLICE));
    if (i === 0)
      await Filesystem.writeFile({ directory, path, data, recursive: true });
    else await Filesystem.appendFile({ directory, path, data });
  }
  return (await Filesystem.getUri({ directory, path })).uri;
}

function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
