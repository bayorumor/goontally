import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, jsonError, parseId, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; personId: string }> };

// Takes a person out of a group. Both stay in the library, and so do the
// person's entries.
export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id, personId: rawPersonId } = await params;
  const groupId = parseId(id);
  const personId = parseId(rawPersonId);
  if (!groupId || !personId) return jsonError("Member not found", 404);

  const { count } = await prisma.personGroup.deleteMany({
    where: { groupId, personId, group: { userId } },
  });
  if (!count) return jsonError("Member not found", 404);

  return NextResponse.json({ message: "Removed from the group" });
}
