import { NextRequest, NextResponse } from "next/server";
import { getUserId, jsonError, unauthorized } from "@/lib/api";
import {
  addOption,
  listOptions,
  removeOption,
  renameOption,
} from "@/lib/customOptions";
import {
  optionBody,
  optionRemoveBody,
  optionRenameBody,
} from "@/lib/schemas";

// Finishes and mediums: the "Log options" sheet lists, renames and removes
// them; the log sheet adds new ones.

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await listOptions(userId));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = optionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { category, label } = parsed.data;

  // Adding a label that already exists is a no-op rather than an error.
  const option = await addOption(userId, category, label);
  return NextResponse.json({ option }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = optionRenameBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { category, from, to } = parsed.data;

  await renameOption(userId, category, from, to);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = optionRemoveBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { category, label, fromEntries } = parsed.data;

  await removeOption(userId, category, label, fromEntries);
  return NextResponse.json({ ok: true });
}
