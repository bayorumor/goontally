import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/api";
import { listGroupRefs, listPersonsForPicker } from "@/lib/queries";
import { listLogOptions } from "@/lib/customOptions";

// Everything the quick-log sheet needs, loaded when it opens.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const [persons, groups, thoughtOptions, mediumOptions] = await Promise.all([
    listPersonsForPicker(userId),
    listGroupRefs(userId),
    listLogOptions(userId, "thought"),
    listLogOptions(userId, "medium"),
  ]);

  return NextResponse.json({ persons, groups, thoughtOptions, mediumOptions });
}
