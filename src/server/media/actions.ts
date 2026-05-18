"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { mediaAssetSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";
import { upsertMediaAssetFromUrl } from "@/server/media/service";

type ActionState = {
  error?: string;
  success?: string;
};

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createMediaAssetAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = mediaAssetSchema.safeParse({
    url: stringValue(formData, "url"),
    altText: stringValue(formData, "altText"),
    caption: stringValue(formData, "caption")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "媒体资源无效" };
  }

  await upsertMediaAssetFromUrl({
    url: parsed.data.url,
    altText: parsed.data.altText ?? "",
    caption: parsed.data.caption,
    userId: user.id
  });

  revalidatePath("/media");
  redirect("/media");
}

export async function deleteMediaAssetAction(formData: FormData) {
  await requireUser();
  const id = stringValue(formData, "id");

  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  revalidatePath("/media");
}
