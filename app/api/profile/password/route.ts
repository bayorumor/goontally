import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getViewer, jsonError, unauthorized } from "@/lib/api";
import { checkPassword } from "@/lib/auth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/constants";

const passwordBody = z.object({
  currentPassword: z.string().max(PASSWORD_MAX),
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`),
});

// Replaces the password. Every other session of this account is signed out;
// the caller signs in again with the new password to keep going.
export async function POST(req: NextRequest) {
  // getViewer, not getUserId: this is the one route an account on a
  // temporary password may use.
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const userId = viewer.id;

  const parsed = passwordBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await checkPassword(user, currentPassword)))
    return jsonError(
      "Current password is wrong. After 5 misses in a row, it pauses for 15 minutes.",
      400,
    );
  if (newPassword === currentPassword)
    return jsonError("Pick a password different from the current one", 400);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      passwordExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  });
  return NextResponse.json({ ok: true });
}
