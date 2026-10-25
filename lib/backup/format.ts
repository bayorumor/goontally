import { z } from "zod";
import { NAME_MAX } from "../constants";

// The .gtbak backup format, shared by the web app and the Android app so a
// backup made in one opens in the other. This file has no server or browser
// dependencies on purpose.
//
// A .gtbak file is a zip (optionally encrypted, see archive.ts) holding:
//   manifest.json   what's inside, readable before importing anything
//   data.json       every row; relations use ids local to this file
//   photos/<uuid>.<ext>
//
// Bump BACKUP_VERSION when data.json changes shape, and keep reading the
// older versions.

export const BACKUP_FORMAT = "goontally-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = ".gtbak";

export const MANIFEST_FILE = "manifest.json";
export const DATA_FILE = "data.json";

// Photo paths inside the zip, e.g. "photos/3f9c2a1e-….jpg".
export const PHOTO_PATH = /^photos\/[A-Za-z0-9-]{1,64}\.(jpg|png|webp|gif)$/;

export const PHOTO_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Same rules as the forms in the app, so an import can't create rows the
// app itself would refuse.
const name = z.string().trim().min(1).max(NAME_MAX);
const label = z.string().trim().min(1).max(100);
const fileId = z.number().int().positive();
const time = z.iso.datetime({ offset: true });
const photo = z.string().regex(PHOTO_PATH).nullable();

const named = z.object({ id: fileId, name, photo, createdAt: time });

export const backupDataSchema = z.object({
  persons: z.array(named).max(20_000),
  groups: z.array(named).max(5_000),
  memberships: z
    .array(z.object({ personId: fileId, groupId: fileId, joinedAt: time }))
    .max(100_000),
  entries: z
    .array(
      z.object({
        loggedAt: time,
        mediumTags: z.array(label).max(50),
        notes: z.string().trim().max(2000).nullable(),
        personIds: z.array(fileId).min(1).max(30),
        thoughts: z
          .array(z.object({ tag: label, personIds: z.array(fileId).max(30) }))
          .max(50),
        createdAt: time,
      }),
    )
    .max(200_000),
  options: z
    .array(
      z.object({
        category: z.enum(["thought", "medium"]),
        label,
        // No longer offered when logging. Missing in older backups.
        hidden: z.boolean().optional(),
        createdAt: time,
      }),
    )
    .max(5_000),
});

export type BackupData = z.infer<typeof backupDataSchema>;

export const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  // Which app wrote the file: "web" or "android".
  app: z.string().max(20),
  createdAt: time,
  counts: z.object({
    persons: z.number().int().min(0),
    groups: z.number().int().min(0),
    entries: z.number().int().min(0),
    photos: z.number().int().min(0),
  }),
});

export type BackupManifest = z.infer<typeof manifestSchema>;

export function makeManifest(
  data: BackupData,
  app: string,
  photos: number,
): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app,
    createdAt: new Date().toISOString(),
    counts: {
      persons: data.persons.length,
      groups: data.groups.length,
      entries: data.entries.length,
      photos,
    },
  };
}

// Checks what the schema can't: ids are unique and every reference points
// at a row in the file. Returns an error message, or null when it's sound.
export function checkReferences(data: BackupData): string | null {
  const personIds = new Set(data.persons.map((p) => p.id));
  const groupIds = new Set(data.groups.map((g) => g.id));
  if (personIds.size !== data.persons.length) return "Duplicate person ids";
  if (groupIds.size !== data.groups.length) return "Duplicate group ids";

  for (const m of data.memberships)
    if (!personIds.has(m.personId) || !groupIds.has(m.groupId))
      return "A group membership points at a missing row";

  for (const e of data.entries) {
    const ids = [...e.personIds, ...e.thoughts.flatMap((t) => t.personIds)];
    if (!ids.every((id) => personIds.has(id)))
      return "An entry points at a missing person";
  }
  return null;
}

// Importing: "merge" adds what's missing, "replace" empties everything
// first.
export type ImportMode = "merge" | "replace";

// The reply to an import (POST /api/backup), on the web and on the phone.
export interface ImportResult {
  added: { persons: number; groups: number; entries: number };
  // Entries already there (merge) or repeated in the file.
  skippedEntries: number;
  // Photos to upload next, to PATCH /api/{kind}s/{id}.
  photos: { path: string; kind: "person" | "group"; id: number }[];
}

// Photo paths the data refers to, without repeats.
export const photoPaths = (data: BackupData) => [
  ...new Set(
    [...data.persons, ...data.groups].flatMap((r) => (r.photo ? [r.photo] : [])),
  ),
];
