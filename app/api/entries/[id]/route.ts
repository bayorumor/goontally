import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getUserId,
  isUniqueViolation,
  jsonError,
  parseId,
  unauthorized,
} from "@/lib/api";
import { parseEntryInput, saveEntry } from "@/lib/entryInput";

type Params = { params: Promise<{ id: string }> };

// Replaces the entry's time, persons, thoughts, mediums and notes. Takes the
// same multipart body as POST /api/entries.
export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const entryId = parseId((await params).id);
  if (!entryId) return jsonError("Entry not found", 404);

  const parsed = await parseEntryInput(req, userId);
  if ("error" in parsed) return parsed.error;

  try {
    const result = await saveEntry(userId, parsed.input, entryId);
    if (!result) return jsonError("Entry not found", 404);
    return NextResponse.json(result);
  } catch (err) {
    if (isUniqueViolation(err))
      return jsonError("That name was just created, please try again", 409);
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const entryId = parseId((await params).id);
  if (!entryId) return jsonError("Entry not found", 404);

  const { count } = await prisma.entry.deleteMany({
    where: { id: entryId, userId },
  });
  if (!count) return jsonError("Entry not found", 404);

  return NextResponse.json({ message: "Entry deleted" });
}
