"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { mediaAssetSchema } from "@/lib/validators";
import { createAiJob } from "@/server/ai/jobs";
import { redirectWithToast } from "@/server/admin/toast";
import { requireContentEditor } from "@/server/auth/session";
import { friendlyDatabaseError } from "@/server/content/errors";
import { db } from "@/server/db";
import { mediaAssets, posts } from "@/server/db/schema";
import {
  getMediaAsset,
  getMediaAssetIdsForBulkCompletion,
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

  try {
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
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/media");
  redirectWithToast({
    path: "/media",
    message: "媒体资源已创建。"
  });
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

  try {
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
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  return { success: "媒体 SEO 信息已保存。" };
}

export async function deleteMediaAssetAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  if (!id) {
    redirectWithToast({
      path: "/media",
      type: "error",
      message: "缺少媒体 ID，无法删除。"
    });
  }

  const [asset] = await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .returning({ id: mediaAssets.id });

  revalidatePath("/media");
  if (!asset) {
    redirectWithToast({
      path: "/media",
      type: "error",
      message: "媒体资源不存在或已删除。"
    });
  }

  redirectWithToast({
    path: "/media",
    message: "媒体资源已删除。"
  });
}

export async function deleteUnusedMediaAssetsAction(formData: FormData) {
  await requireContentEditor();
  const requestedIds = formData.getAll("ids").map(String).filter(Boolean);
  if (!requestedIds.length) {
    redirectWithToast({
      path: "/media",
      type: "error",
      message: "请先勾选要删除的未使用图片。"
    });
  }

  const ids = await getUnusedMediaAssetIds(requestedIds);

  if (!ids.length) {
    revalidatePath("/media");
    redirectWithToast({
      path: "/media",
      type: "error",
      message: "勾选的图片都正在使用，未执行删除。"
    });
  }

  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(mediaAssets.id, ids), isNull(mediaAssets.deletedAt)));

  revalidatePath("/media");
  redirectWithToast({
    path: "/media",
    message: `已删除 ${ids.length} 张未使用图片。`
  });
}

export async function regenerateMediaVariantsAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  if (!id) {
    redirectWithToast({
      path: "/media",
      type: "error",
      message: "缺少媒体 ID，无法生成衍生图。"
    });
  }

  const asset = await getMediaAsset(id);

  if (!asset || asset.storageProvider !== "local" || !asset.storageKey) {
    revalidatePath("/media");
    redirectWithToast({
      path: asset ? `/media/${id}` : "/media",
      type: "error",
      message: asset
        ? "只有已上传到本地的图片才能生成衍生图。"
        : "媒体资源不存在或已删除。"
    });
  }

  let variants;
  try {
    variants = await regenerateMediaAssetVariants({
      storageKey: asset.storageKey
    });
  } catch (error) {
    redirectWithToast({
      path: `/media/${id}`,
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "衍生图生成失败，请检查图片文件。"
    });
  }

  await db
    .update(mediaAssets)
    .set({ variants, updatedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  redirectWithToast({
    path: `/media/${id}`,
    message: "图片衍生图已重新生成。"
  });
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

const providerValues = ["all", "local", "external_url"] as const;
const usageValues = ["all", "used", "unused"] as const;
const mediaNeedsValues = [
  "all",
  "missing_zh_alt",
  "missing_en_seo",
  "unused",
  "missing_variants"
] as const;

function enumValue<TValue extends string>(
  value: string,
  values: readonly TValue[],
  fallback: TValue
) {
  return values.includes(value as TValue) ? (value as TValue) : fallback;
}

export async function bulkGenerateMediaMetadataAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
  const query = stringValue(formData, "q");
  const provider = enumValue(stringValue(formData, "provider"), providerValues, "all");
  const usage = enumValue(stringValue(formData, "usage"), usageValues, "all");
  const needs = enumValue(stringValue(formData, "needs"), mediaNeedsValues, "all");
  const ids = await getMediaAssetIdsForBulkCompletion({
    query,
    provider,
    usage,
    needs,
    limit: 20
  });

  if (!ids.length) {
    return { error: "当前筛选下没有可补全的媒体资源。" };
  }

  const job = await createAiJob({
    type: "bulk_media_metadata",
    input: {
      mediaAssetIds: ids
    },
    userId: user.id
  });

  return {
    success: `已提交 ${ids.length} 张图片的 AI 补全任务。`,
    jobId: job.id
  };
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
    .select({ id: posts.id, coverImage: posts.coverImage })
    .from(posts)
    .where(and(inArray(posts.id, uniqueIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    return { error: "没有找到可生成封面的文章。" };
  }

  const targetRows = overwriteExisting
    ? rows
    : rows.filter((row) => !row.coverImage);

  if (!targetRows.length) {
    return {
      error:
        "选中的文章都已有封面。请勾选“覆盖已有封面的文章”，或选择无封面的文章。"
    };
  }

  const job = await createAiJob({
    type: "bulk_post_cover_images",
    input: {
      postIds: targetRows.map((row) => row.id),
      overwriteExisting
    },
    userId: user.id
  });

  return {
    success: `已提交 ${targetRows.length} 篇文章的封面生成任务。`,
    jobId: job.id
  };
}
