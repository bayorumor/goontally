import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "./prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep well under typical serverless request body limits (~4.5MB on Vercel).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const PRESETS = {
  person: {
    folder: "goontally/persons",
    transformation: [{ width: 800, crop: "limit", quality: "auto" }],
  },
  group: {
    folder: "goontally/groups",
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
  user: {
    folder: "goontally/users",
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
};

export type ImageKind = keyof typeof PRESETS;

// Returns the file when the form value is a non-empty upload, null when absent.
export function getImageFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

// Photos are cropped to JPEG in the browser; these cover uploads from
// elsewhere. Vector formats like SVG are left out on purpose.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Returns an error message, or null when the file is acceptable.
export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type))
    return "Use a JPEG, PNG, WebP or GIF image";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 4MB or smaller";
  return null;
}

// Multipart forms that create several rows send each photo as its own
// "photo:<key>" field. Returns the files by key, or an error message.
export function readPhotos(
  form: FormData,
  keys: (string | undefined)[],
): Map<string, File> | string {
  const photos = new Map<string, File>();
  for (const key of keys) {
    if (!key || photos.has(key)) continue;
    const file = getImageFile(form.get(`photo:${key}`));
    if (!file) return "Missing photo upload";
    const invalid = validateImage(file);
    if (invalid) return invalid;
    photos.set(key, file);
  }
  return photos;
}

// Each upload gets a random name, so the URL of one photo says nothing about
// the others: Cloudinary serves uploads to anyone who has the address.
export async function uploadImage(file: File, kind: ImageKind) {
  const preset = PRESETS[kind];
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(base64, {
    folder: preset.folder,
    public_id: randomUUID(),
    transformation: preset.transformation,
  });
  return result.secure_url;
}

export type PhotoUpload = {
  kind: "person" | "group";
  id: number;
  file: File;
};

// Uploads photos for rows that were just committed and stores their URLs.
// Runs after the transaction so a slow or failed upload never rolls back the
// rows; they simply stay without a photo. Returns whether any upload failed.
export async function savePhotos(uploads: PhotoUpload[]) {
  const results = await Promise.allSettled(
    uploads.map(async ({ kind, id, file }) => {
      const photoUrl = await uploadImage(file, kind);
      if (kind === "group")
        await prisma.group.update({ where: { id }, data: { photoUrl } });
      else await prisma.person.update({ where: { id }, data: { photoUrl } });
    }),
  );
  return results.some((r) => r.status === "rejected");
}

// Best-effort cleanup once the row is gone; a leftover image only costs
// storage, so failures are ignored. The public id is read back from the
// delivery URL: .../image/upload/v123/<public id>.jpg
export async function deleteImage(photoUrl: string | null) {
  const publicId = photoUrl?.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/)?.[1];
  if (!publicId) return;
  await cloudinary.uploader
    .destroy(publicId, { invalidate: true })
    .catch(() => {});
}
