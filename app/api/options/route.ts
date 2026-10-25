import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, jsonError, unauthorized } from "@/lib/api";
import { optionBody } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = optionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { category, label } = parsed.data;

  // Adding a label that already exists is a no-op rather than an error.
  const option = await prisma.userCustomOption.upsert({
    where: { userId_category_label: { userId, category, label } },
    update: {},
    create: { userId, category, label },
  });

  return NextResponse.json({ option }, { status: 201 });
}
