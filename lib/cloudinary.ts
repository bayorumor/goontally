import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "./prisma";

export {
  getImageFile,
  MAX_IMAGE_BYTES,
  readPhotos,
  validateImage,
} from "./schemas";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
