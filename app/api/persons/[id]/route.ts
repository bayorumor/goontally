import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, jsonError, parseId, unauthorized } from "@/lib/api";
import { deleteImage } from "@/lib/cloudinary";
import { findOwned, updateNamed } from "@/lib/library";

type Params = { params: Promise<{ id: string }> };

// Rename and/or new photo.
export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const personId = parseId((await params).id);
  if (!personId) return jsonError("Person not found", 404);
  return updateNamed("person", userId, personId, req);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const personId = parseId((await params).id);
  if (!personId) return jsonError("Person not found", 404);

  const person = await findOwned("person", userId, personId);
  if (!person) return jsonError("Person not found", 404);

  await prisma.$transaction(async (tx) => {
    const affected = await tx.entryPerson.findMany({
      where: { personId },
      select: { entryId: true },
    });
    const affectedEntryIds = affected.map((e) => e.entryId);

    await tx.person.delete({ where: { id: personId } });

    if (!affectedEntryIds.length) return;

    // EntryThought.personIds has no foreign key, so drop the deleted id by
    // hand, and drop thoughts that were only about this person.
    await tx.$executeRaw`
      UPDATE "EntryThought"
      SET "personIds" = array_remove("personIds", ${personId})
      WHERE "entryId" = ANY(${affectedEntryIds}::int[]) AND ${personId} = ANY("personIds")
    `;
    await tx.entryThought.deleteMany({
      where: {
        entryId: { in: affectedEntryIds },
        personIds: { isEmpty: true },
      },
    });

    // Entries that were only about this person are now empty.
    await tx.entry.deleteMany({
      where: { id: { in: affectedEntryIds }, persons: { none: {} } },
    });
  });

  await deleteImage(person.photoUrl);
  return NextResponse.json({ message: "Person deleted" });
}
