import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, jsonError, parseId, unauthorized } from "@/lib/api";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const optionId = parseId((await params).id);
  if (!optionId) return jsonError("Option not found", 404);

  const { count } = await prisma.userCustomOption.deleteMany({
    where: { id: optionId, userId },
  });
  if (!count) return jsonError("Option not found", 404);

  return NextResponse.json({ message: "Option deleted" });
}
