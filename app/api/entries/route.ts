import { NextRequest, NextResponse } from "next/server";
import { listEntries } from "@/lib/queries";
import { parseEntryInput, saveEntry } from "@/lib/entryInput";
import {
  getUserId,
  isUniqueViolation,
  jsonError,
  parseId,
  unauthorized,
} from "@/lib/api";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);

  const personParam = searchParams.get("personId");
  const personId = personParam ? parseId(personParam) : null;
  if (personParam && !personId) return jsonError("Invalid personId", 400);

  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "20") || 20, 1),
    100,
  );

  // The next page starts after this entry: ?afterAt=<ISO time>&afterId=<id>.
  const afterAt = new Date(searchParams.get("afterAt") ?? "");
  const afterId = parseId(searchParams.get("afterId"));
  const after =
    afterId && !isNaN(afterAt.getTime())
      ? { loggedAt: afterAt, id: afterId }
      : undefined;

  return NextResponse.json(
    await listEntries(userId, {
      personId: personId ?? undefined,
      limit,
      after,
    }),
  );
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = await parseEntryInput(req, userId);
  if ("error" in parsed) return parsed.error;

  try {
    const result = await saveEntry(userId, parsed.input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err))
      return jsonError("That name was just created, please try again", 409);
    throw err;
  }
}
