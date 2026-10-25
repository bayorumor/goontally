import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/api";

// Records that the account agreed to the terms of use (shown once, before
// first use). Agreeing again keeps the first date.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  await prisma.user.updateMany({
    where: { id: userId, termsAcceptedAt: null },
    data: { termsAcceptedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
