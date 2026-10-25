import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { NAME_MAX } from "./constants";
import { addPersonsBody, nameField } from "./schemas";
import { isUniqueViolation, jsonError, nameEquals } from "./api";
import {
  deleteImage,
  getImageFile,
  PhotoUpload,
  readPhotos,
  savePhotos,
  uploadImage,
  validateImage,
} from "./cloudinary";

// Persons and groups share their naming rules and their rename/photo/delete
// handlers, so the routes for both stay thin.

type Kind = "person" | "group";

const LABEL: Record<Kind, (name: string) => string> = {
  person: (name) => `"${name}" already exists`,
  group: (name) => `Group "${name}" already exists`,
};
const NOT_FOUND: Record<Kind, string> = {
  person: "Person not found",
  group: "Group not found",
};

// The two models expose the same calls with different types; this narrows
// them to the handful used here.
type NamedDelegate = {
  findFirst(args: object): Promise<{
    id: number;
    name: string;
    photoUrl: string | null;
  } | null>;
  update(args: object): Promise<unknown>;
  delete(args: object): Promise<unknown>;
};
const model = (kind: Kind) =>
  (kind === "person" ? prisma.person : prisma.group) as unknown as NamedDelegate;

export const findOwned = (kind: Kind, userId: number, id: number) =>
  model(kind).findFirst({
    where: { id, userId },
    select: { id: true, name: true, photoUrl: true },
  });

// PATCH: a multipart form with an optional new "name" and/or "photo".
export async function updateNamed(
  kind: Kind,
  userId: number,
  id: number,
  req: NextRequest,
) {
  const row = await findOwned(kind, userId, id);
  if (!row) return jsonError(NOT_FOUND[kind], 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const rawName = String(form.get("name") ?? "").trim();
  const photo = getImageFile(form.get("photo"));
  const updates: { name?: string; photoUrl?: string } = {};

  if (rawName && rawName !== row.name) {
    const parsed = nameField.safeParse(rawName);
    if (!parsed.success)
      return jsonError(`Names can be up to ${NAME_MAX} characters`, 400);
    const clash = await model(kind).findFirst({
      where: { userId, name: nameEquals(parsed.data), id: { not: id } },
      select: { id: true, name: true, photoUrl: true },
    });
    if (clash) return jsonError(LABEL[kind](clash.name), 409);
    updates.name = parsed.data;
  }

  if (photo) {
    const invalid = validateImage(photo);
    if (invalid) return jsonError(invalid, 400);
    try {
      updates.photoUrl = await uploadImage(photo, kind);
    } catch {
      return jsonError("Couldn't upload the image, please try again", 502);
    }
  }

  try {
    await model(kind).update({ where: { id }, data: updates });
  } catch (err) {
    // The new photo isn't used after all.
    if (updates.photoUrl) await deleteImage(updates.photoUrl);
    if (isUniqueViolation(err))
      return jsonError(LABEL[kind](updates.name ?? row.name), 409);
    throw err;
  }
  // A new photo has a new name, so the old file is now unused.
  if (updates.photoUrl) await deleteImage(row.photoUrl);
  return NextResponse.json({ ok: true });
}

// DELETE for a group: members stay in the library. Persons have their own
// handler because their entries need tidying up.
export async function deleteGroup(userId: number, id: number) {
  const row = await findOwned("group", userId, id);
  if (!row) return jsonError(NOT_FOUND.group, 404);
  await prisma.group.delete({ where: { id } });
  await deleteImage(row.photoUrl);
  return NextResponse.json({ message: "Group deleted" });
}

// POST /api/persons: adds persons to the library, optionally into a group,
// in one transaction. Existing persons can only be added to a group.
// Thrown inside the transaction so it rolls back, carrying the reply.
class Rejected extends Error {
  constructor(readonly response: NextResponse) {
    super("rejected");
  }
}

export async function addToLibrary(userId: number, req: NextRequest) {
  let form: FormData;
  let raw: unknown;
  try {
    form = await req.formData();
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const parsed = addPersonsBody.safeParse(raw);
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { group, persons } = parsed.data;

  const photos = readPhotos(form, [
    group?.groupPhotoKey,
    ...persons.map((r) => r.personPhotoKey),
  ]);
  if (typeof photos === "string") return jsonError(photos, 400);

  // Each new name only once, compared the way the database does.
  const newNames = persons.flatMap((r) =>
    r.newPersonName ? [r.newPersonName] : [],
  );
  const seen = new Set<string>();
  for (const n of newNames) {
    if (seen.has(n.toLowerCase())) return jsonError(LABEL.person(n), 409);
    seen.add(n.toLowerCase());
  }

  const uploads: PhotoUpload[] = [];
  let savedGroupId: number | null;
  try {
    savedGroupId = await prisma.$transaction(async (tx) => {
      let groupId = group?.groupId ?? null;
      if (groupId) {
        const owned = await tx.group.count({ where: { id: groupId, userId } });
        if (!owned) throw new Rejected(jsonError(NOT_FOUND.group, 404));
      } else if (group?.newGroupName) {
        const clash = await tx.group.findFirst({
          where: { userId, name: nameEquals(group.newGroupName) },
          select: { name: true },
        });
        if (clash)
          throw new Rejected(jsonError(LABEL.group(clash.name), 409));
        groupId = (
          await tx.group.create({ data: { name: group.newGroupName, userId } })
        ).id;
        const file = group.groupPhotoKey && photos.get(group.groupPhotoKey);
        if (file) uploads.push({ kind: "group", id: groupId, file });
      }

      const existingIds = persons.flatMap((r) =>
        r.personId ? [r.personId] : [],
      );
      const owned = await tx.person.count({
        where: { id: { in: existingIds }, userId },
      });
      if (owned !== new Set(existingIds).size)
        throw new Rejected(jsonError(NOT_FOUND.person, 404));

      const clash = await tx.person.findFirst({
        where: { userId, OR: newNames.map((n) => ({ name: nameEquals(n) })) },
        select: { name: true },
      });
      if (newNames.length && clash)
        throw new Rejected(jsonError(LABEL.person(clash.name), 409));

      const memberIds = [...existingIds];
      for (const row of persons) {
        if (!row.newPersonName) continue;
        const { id } = await tx.person.create({
          data: { name: row.newPersonName, userId },
        });
        memberIds.push(id);
        const file = row.personPhotoKey && photos.get(row.personPhotoKey);
        if (file) uploads.push({ kind: "person", id, file });
      }

      if (groupId)
        await tx.personGroup.createMany({
          data: memberIds.map((personId) => ({ personId, groupId })),
          skipDuplicates: true,
        });
      return groupId;
    });
  } catch (err) {
    if (err instanceof Rejected) return err.response;
    if (isUniqueViolation(err))
      return jsonError("That name was just created, please try again", 409);
    throw err;
  }

  const photoFailed = await savePhotos(uploads);
  return NextResponse.json(
    {
      groupId: savedGroupId,
      ...(photoFailed
        ? { warning: "Saved, but some images failed to upload" }
        : {}),
    },
    { status: 201 },
  );
}
