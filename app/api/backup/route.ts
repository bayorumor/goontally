import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, jsonError, unauthorized } from "@/lib/api";
import { backupDataSchema, checkReferences } from "@/lib/backup/format";
import { exportRows, importRows } from "@/lib/backup/server";

// A big import runs a few bulk inserts; give it room past the default.
export const maxDuration = 60;

// The rows for a backup; the browser adds the photos and packs the file.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await exportRows(userId), {
    headers: { "Cache-Control": "no-store" },
  });
}

const importBody = z.object({
  mode: z.enum(["merge", "replace"]),
  data: backupDataSchema,
});

// Restores rows from a backup the browser has already unpacked. Answers
// which photos to upload next.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = importBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("The backup's data is damaged", 400);
  const broken = checkReferences(parsed.data.data);
  if (broken) return jsonError(`The backup's data is damaged: ${broken}`, 400);

  return NextResponse.json(
    await importRows(userId, parsed.data.data, parsed.data.mode),
  );
}
