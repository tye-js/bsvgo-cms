"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { mediaAssetSchema } from "@/lib/validators";
import { createAiJob } from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaAssets, posts } from "@/server/db/schema";
import {
  getMediaAsset,
  getUnusedMediaAssetIds,
  upsertMediaAssetFromUrl
} from "@/server/media/service";
import { regenerateMediaAssetVariants } from "@/server/media/upload";

type ActionState = {
  error?: string;
  success?: string;
  jobId?: string;
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
    caption: stringValue(formData, "caption"),
    zhAltText: stringValue(formData, "zhAltText"),
    enAltText: stringValue(formData, "enAltText"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "媒体资源无效" };
  }

  await upsertMediaAssetFromUrl({
    url: parsed.data.url,
    altText: parsed.data.altText ?? "",
    caption: parsed.data.caption,
    zhAltText: parsed.data.zhAltText,
    enAltText: parsed.data.enAltText,
    zhSeoTitle: parsed.data.zhSeoTitle,
    zhSeoDescription: parsed.data.zhSeoDescription,
    enSeoTitle: parsed.data.enSeoTitle,
    enSeoDescription: parsed.data.enSeoDescription,
    userId: user.id
  });

  revalidatePath("/media");
  redirect("/media");
}

export async function updateMediaAssetMetadataAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  const parsed = mediaAssetSchema.omit({ url: true }).safeParse({
    altText: stringValue(formData, "altText"),
    caption: stringValue(formData, "caption"),
    zhAltText: stringValue(formData, "zhAltText"),
    enAltText: stringValue(formData, "enAltText"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "媒体 SEO 信息无效" };
  }
  const asset = await getMediaAsset(id);
  if (!asset) {
    return { error: "媒体资源不存在或已删除。" };
  }

  const zhAltText = parsed.data.zhAltText ?? "";
  const enAltText = parsed.data.enAltText ?? "";
  const altText = zhAltText || enAltText || parsed.data.altText || asset.altText;
  const zhSeoDescription = parsed.data.zhSeoDescription ?? "";
  const enSeoDescription = parsed.data.enSeoDescription ?? "";

  await db
    .update(mediaAssets)
    .set({
      altText,
      caption: parsed.data.caption ?? "",
      zhAltText,
      enAltText,
      zhSeoTitle: parsed.data.zhSeoTitle ?? "",
      zhSeoDescription,
      enSeoTitle: parsed.data.enSeoTitle ?? "",
      enSeoDescription,
      metadata: {
        ...(asset.metadata ?? {}),
        seoSummary: zhSeoDescription || enSeoDescription,
        manuallyEdited: true,
        editedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    })
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)));

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  return { success: "媒体 SEO 信息已保存。" };
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

export async function generateMediaMetadataAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
  const id = stringValue(formData, "id");
  const asset = await getMediaAsset(id);

  if (!asset) {
    return { error: "媒体资源不存在或已删除。" };
  }

  const job = await createAiJob({
    type: "media_metadata",
    input: { mediaAssetId: id },
    userId: user.id
  });

  return { success: "图片 SEO 任务已提交。", jobId: job.id };
}

export async function bulkGeneratePostCoverImagesAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
  const requestedIds = formData.getAll("postIds").map(String).filter(Boolean);
  const overwriteExisting = stringValue(formData, "overwriteExisting") === "on";
  const uniqueIds = Array.from(new Set(requestedIds)).slice(0, 10);

  if (!uniqueIds.length) {
    return { error: "请选择需要生成封面的文章。" };
  }

  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.id, uniqueIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    return { error: "没有找到可生成封面的文章。" };
  }

  const job = await createAiJob({
    type: "bulk_post_cover_images",
    input: {
      postIds: rows.map((row) => row.id),
      overwriteExisting
    },
    userId: user.id
  });

  return {
    success: `已提交 ${rows.length} 篇文章的封面生成任务。`,
    jobId: job.id
  };
}
