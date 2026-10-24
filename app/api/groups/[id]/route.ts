import { NextRequest } from "next/server";
import { getUserId, jsonError, parseId, unauthorized } from "@/lib/api";
import { deleteGroup, updateNamed } from "@/lib/library";

type Params = { params: Promise<{ id: string }> };

// Rename and/or new photo.
export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const groupId = parseId((await params).id);
  if (!groupId) return jsonError("Group not found", 404);
  return updateNamed("group", userId, groupId, req);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const groupId = parseId((await params).id);
  if (!groupId) return jsonError("Group not found", 404);
  return deleteGroup(userId, groupId);
}
