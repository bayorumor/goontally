import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "./prisma";
import { jsonError, nameEquals } from "./api";
import { PhotoUpload, readPhotos, savePhotos } from "./cloudinary";
import { entryBody, type EntryBody } from "./schemas";

// Shared by POST /api/entries (create) and PATCH /api/entries/[id] (edit):
// both take the same multipart form and resolve persons/groups the same way.

export interface EntryInput {
  body: EntryBody;
  photos: Map<string, File>;
}

type Parsed = { input: EntryInput } | { error: NextResponse };

// Validates the form and checks every referenced id belongs to the user.
export async function parseEntryInput(
  req: NextRequest,
  userId: number,
): Promise<Parsed> {
  let form: FormData;
  let raw: unknown;
  try {
    form = await req.formData();
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return { error: jsonError("Invalid request body", 400) };
  }
  const parsed = entryBody.safeParse(raw);
  if (!parsed.success)
    return {
      error: jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400),
    };
  const body = parsed.data;

  // Photos referenced by the rows must be present and valid images.
  const photos = readPhotos(
    form,
    body.persons.flatMap((r) => [r.personPhotoKey, r.groupPhotoKey]),
  );
  if (typeof photos === "string") return { error: jsonError(photos, 400) };

  const personIds = [
    ...new Set(body.persons.flatMap((r) => (r.personId ? [r.personId] : []))),
  ];
  const groupIds = [
    ...new Set(body.persons.flatMap((r) => (r.groupId ? [r.groupId] : []))),
  ];
  const [ownedPersons, ownedGroups] = await Promise.all([
    prisma.person.count({ where: { id: { in: personIds }, userId } }),
    prisma.group.count({ where: { id: { in: groupIds }, userId } }),
  ]);
  if (ownedPersons !== personIds.length)
    return { error: jsonError("Person not found", 404) };
  if (ownedGroups !== groupIds.length)
    return { error: jsonError("Group not found", 404) };

  return { input: { body, photos } };
}

// Creates the entry, or replaces an existing one's fields, persons and
// thoughts, in one transaction. Returns null when `entryId` isn't the user's.
export async function saveEntry(
  userId: number,
  { body, photos }: EntryInput,
  entryId?: number,
) {
  const uploads: PhotoUpload[] = [];

  const saved = await prisma.$transaction(async (tx) => {
    if (entryId) {
      const owned = await tx.entry.count({ where: { id: entryId, userId } });
      if (!owned) return null;
    }

    const { entryPersonIds, thoughts } = await resolveRows(
      tx,
      userId,
      body,
      photos,
      uploads,
    );
    const fields = {
      loggedAt: body.loggedAt ?? new Date(),
      mediumTags: body.mediumTags,
      notes: body.notes || null,
      persons: { create: entryPersonIds.map((personId) => ({ personId })) },
      ...(thoughts.length ? { thoughts: { create: thoughts } } : {}),
    };

    if (!entryId)
      return tx.entry.create({
        data: { userId, ...fields },
        select: { id: true },
      });

    await tx.entryPerson.deleteMany({ where: { entryId } });
    await tx.entryThought.deleteMany({ where: { entryId } });
    return tx.entry.update({
      where: { id: entryId },
      data: fields,
      select: { id: true },
    });
  });

  if (!saved) return null;

  const photoFailed = await savePhotos(uploads);
  const entry = await prisma.entry.findUniqueOrThrow({
    where: { id: saved.id },
    select: { id: true, persons: { select: { personId: true } } },
  });

  return {
    entry: { id: entry.id, personIds: entry.persons.map((p) => p.personId) },
    ...(photoFailed
      ? { warning: "Saved, but some photos failed to upload" }
      : {}),
  };
}

async function resolveRows(
  tx: Prisma.TransactionClient,
  userId: number,
  body: EntryInput["body"],
  photos: Map<string, File>,
  uploads: PhotoUpload[],
) {
  // New names are matched case-insensitively against existing rows and
  // against each other, so the same name always resolves to one row.
  const groupByName = new Map<string, number>();
  const personByName = new Map<string, number>();

  const resolveGroup = async (groupName: string, photoKey?: string) => {
    const key = groupName.toLowerCase();
    const known = groupByName.get(key);
    if (known) return known;
    const existing = await tx.group.findFirst({
      where: { userId, name: nameEquals(groupName) },
      select: { id: true },
    });
    const groupId =
      existing?.id ??
      (await tx.group.create({ data: { name: groupName, userId } })).id;
    if (!existing && photoKey)
      uploads.push({ kind: "group", id: groupId, file: photos.get(photoKey)! });
    groupByName.set(key, groupId);
    return groupId;
  };

  const resolvePerson = async (personName: string, photoKey?: string) => {
    const key = personName.toLowerCase();
    const known = personByName.get(key);
    if (known) return known;
    const existing = await tx.person.findFirst({
      where: { userId, name: nameEquals(personName) },
      select: { id: true },
    });
    const personId =
      existing?.id ??
      (await tx.person.create({ data: { name: personName, userId } })).id;
    if (!existing && photoKey)
      uploads.push({
        kind: "person",
        id: personId,
        file: photos.get(photoKey)!,
      });
    personByName.set(key, personId);
    return personId;
  };

  const links: { personId: number; groupId: number }[] = [];
  const entryPersonIds: number[] = [];
  // The resolved person id of each row, for thoughts that point at rows.
  const rowPersonIds: number[] = [];

  for (const row of body.persons) {
    const groupId = row.newGroupName
      ? await resolveGroup(row.newGroupName, row.groupPhotoKey)
      : row.groupId;
    const personId = row.newPersonName
      ? await resolvePerson(row.newPersonName, row.personPhotoKey)
      : row.personId!;

    rowPersonIds.push(personId);
    if (!entryPersonIds.includes(personId)) entryPersonIds.push(personId);
    if (groupId) links.push({ personId, groupId });
  }

  if (links.length)
    await tx.personGroup.createMany({ data: links, skipDuplicates: true });

  // A thought with no rows (e.g. a one-person entry) is about everyone.
  const thoughts = body.thoughts.map((t) => {
    const ids = [...new Set(t.rows.map((r) => rowPersonIds[r]))];
    return { tag: t.tag, personIds: ids.length ? ids : entryPersonIds };
  });

  return { entryPersonIds, thoughts };
}
