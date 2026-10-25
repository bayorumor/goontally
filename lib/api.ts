import { cache } from "react";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { equalsIgnoringCase } from "./match";
import { parseId } from "./ids";
import { prisma } from "./prisma";

// Cached per request, so the layout and the page share one session lookup.
export const getSession = cache(() => getServerSession(authOptions));

// The signed-in user, or null. Sessions are JWTs that outlive the account
// and its password, so the user is looked up too: removing someone, or
// changing their password, signs out their older sessions straight away.
export const getViewer = cache(async () => {
  const session = await getSession();
  const id = parseId(session?.user?.id);
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, sessionVersion: true, mustChangePassword: true },
  });
  if (!user || user.sessionVersion !== (session?.user.sessionVersion ?? 0))
    return null;
  return user;
});

// For API routes. An account still on a temporary password gets nothing
// until it picks its own (that route uses getViewer instead).
export async function getUserId(): Promise<number | null> {
  const viewer = await getViewer();
  return viewer && !viewer.mustChangePassword ? viewer.id : null;
}

// For server-rendered pages: the signed-in user's id, or a redirect to login.
export async function requireUserId(): Promise<number> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}

export const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export const unauthorized = () => jsonError("Unauthorized", 401);

export { parseId };

export function isUniqueViolation(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

// Case-insensitive name match, used to stop "Alex" and "alex"
// from becoming two different rows.
export const nameEquals = equalsIgnoringCase;
