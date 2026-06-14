"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { mediaAssetSchema } from "@/lib/validators";
import { generateMediaMetadata } from "@/server/ai/openai";
import { requireContentEditor } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";
import {
  getMediaAsset,
  getUnusedMediaAssetIds,
  upsertMediaAssetFromUrl
} from "@/server/media/service";
import { regenerateMediaAssetVariants } from "@/server/media/upload";

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
  const user = await requireContentEditor();
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
  await requireContentEditor();
  const id = stringValue(formData, "id");

  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  revalidatePath("/media");
  redirect("/media");
}

export async function deleteUnusedMediaAssetsAction(formData: FormData) {
  await requireContentEditor();
  const requestedIds = formData.getAll("ids").map(String).filter(Boolean);
  const ids = await getUnusedMediaAssetIds(requestedIds);

  if (!ids.length) {
    revalidatePath("/media");
    return;
  }

  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(mediaAssets.id, ids), isNull(mediaAssets.deletedAt)));

  revalidatePath("/media");
}

export async function regenerateMediaVariantsAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  const asset = await getMediaAsset(id);

  if (!asset || asset.storageProvider !== "local" || !asset.storageKey) {
    revalidatePath("/media");
    return;
  }

  const variants = await regenerateMediaAssetVariants({
    storageKey: asset.storageKey
  });

  await db
    .update(mediaAssets)
    .set({ variants, updatedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
}

export async function generateMediaMetadataAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  const asset = await getMediaAsset(id);
  if (!asset) return;

  const metadata = await generateMediaMetadata({
    url: asset.url,
    originalFilename: asset.originalFilename,
    width: asset.width,
    height: asset.height,
    currentAltText: asset.altText,
    currentCaption: asset.caption
  });

  await db
    .update(mediaAssets)
    .set({
      altText: metadata.altText || asset.altText,
      caption: metadata.caption || asset.caption,
      metadata: {
        ...(asset.metadata ?? {}),
        seoSummary: metadata.seoSummary,
        generatedBy: "ai",
        generatedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    })
    .where(eq(mediaAssets.id, id));

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
}
