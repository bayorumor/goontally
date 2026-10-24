import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, jsonError, unauthorized } from "@/lib/api";
import {
  deleteImage,
  getImageFile,
  uploadImage,
  validateImage,
} from "@/lib/cloudinary";

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const formData = await req.formData();
  const photo = getImageFile(formData.get("avatar"));

  if (!photo) return jsonError("Avatar image is required", 400);
  const invalid = validateImage(photo);
  if (invalid) return jsonError(invalid, 400);

  let avatar: string;
  try {
    avatar = await uploadImage(photo, "user");
  } catch {
    return jsonError("Couldn't upload the photo, please try again", 502);
  }

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatar: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { avatar },
  });
  await deleteImage(before.avatar);

  return NextResponse.json({ avatar });
}
