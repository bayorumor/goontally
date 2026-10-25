import { z } from "zod";
import { NAME_MAX } from "./constants";

// Request bodies the API accepts. Shared by the web routes and the Android
// app's local API, so both refuse the same things. No server imports here.

export const nameField = z.string().trim().min(1).max(NAME_MAX);

const id = z.number().int().positive();
const photoKey = z.string().max(50);

// POST /api/persons: adds persons to the library, optionally into a new or
// existing group. Photos for new rows are sent as "photo:<key>" fields.
export const addPersonsBody = z
  .object({
    group: z
      .object({
        groupId: id.optional(),
        newGroupName: nameField.optional(),
        groupPhotoKey: photoKey.optional(),
      })
      .refine((g) => !!g.groupId !== !!g.newGroupName, {
        message: "Pick a group or name a new one",
      })
      .optional(),
    persons: z
      .array(
        z
          .object({
            personId: id.optional(),
            newPersonName: nameField.optional(),
            personPhotoKey: photoKey.optional(),
          })
          .refine((r) => !!r.personId !== !!r.newPersonName, {
            message: "Each row needs either an existing person or a new name",
          }),
      )
      .min(1, "Add at least one person")
      .max(30),
  })
  .refine((b) => b.group || b.persons.every((r) => r.newPersonName), {
    message: "Existing persons can only be added to a group",
  });

export type AddPersonsBody = z.infer<typeof addPersonsBody>;

// POST /api/entries (create) and PATCH /api/entries/[id] (edit). Each person
// row is either an existing person or a new name, optionally paired with an
// existing group or a new group name.
const personRow = z
  .object({
    personId: id.optional(),
    newPersonName: nameField.optional(),
    personPhotoKey: photoKey.optional(),
    groupId: id.optional(),
    newGroupName: nameField.optional(),
    groupPhotoKey: photoKey.optional(),
  })
  .refine((r) => !!r.personId !== !!r.newPersonName, {
    message: "Each row needs either an existing person or a new name",
  })
  .refine((r) => !(r.groupId && r.newGroupName), {
    message: "A row can't have both an existing and a new group",
  });

export const entryBody = z
  .object({
    loggedAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).nullish(),
    mediumTags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    persons: z
      .array(personRow)
      .min(1, "At least one person is required")
      .max(30),
    // Each thought names the persons it's about by their index in `persons`,
    // so it can point at persons that are only being created by this request.
    thoughts: z
      .array(
        z.object({
          tag: z.string().trim().min(1).max(100),
          rows: z.array(z.number().int().min(0)).max(30),
        }),
      )
      .max(50)
      .default([]),
  })
  .refine(
    (b) => b.thoughts.every((t) => t.rows.every((r) => r < b.persons.length)),
    { message: "A thought points at a person that isn't in the entry" },
  );

export type EntryBody = z.infer<typeof entryBody>;

// POST /api/options: a custom finish ("thought") or medium label.
export const optionBody = z.object({
  category: z.enum(["thought", "medium"], "Category is required"),
  label: z
    .string("Label is required")
    .trim()
    .min(1, "Label is required")
    .max(100),
});

// Photos are cropped to JPEG in the browser; these cover uploads from
// elsewhere. Vector formats like SVG are left out on purpose.
export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Keep well under typical serverless request body limits (~4.5MB on Vercel).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Returns an error message, or null when the file is acceptable.
export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type))
    return "Use a JPEG, PNG, WebP or GIF image";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 4MB or smaller";
  return null;
}

// Returns the file when the form value is a non-empty upload, null when absent.
export function getImageFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
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
