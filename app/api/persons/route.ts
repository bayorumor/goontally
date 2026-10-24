import { NextRequest } from "next/server";
import { getUserId, unauthorized } from "@/lib/api";
import { addToLibrary } from "@/lib/library";

// Adds one or more persons, optionally into a new or existing group.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return addToLibrary(userId, req);
}
