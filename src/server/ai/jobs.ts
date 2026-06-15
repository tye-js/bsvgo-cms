import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  generateDraftMetadata,
  generateChineseDraftCore,
  generateMediaMetadata,
  generatePostCoverImage,
  generateSeoSuggestion,
  translateDraftToEnglish,
  type CoverImageCategory,
  type ChineseDraftCoreInput,
  type DraftMetadataInput,
  type DraftMetadataOutput,
  type DraftTranslationInput,
  type DraftTranslationOutput,
  type ChineseDraftCoreOutput,
  type MediaMetadataOutput
} from "@/server/ai/openai";
import {
  SourceIngestionError,
  fetchAiDraftSource
} from "@/server/ai/source-ingestion";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/session";
import {
  aiJobs,
  categories,
  categoryTranslations,
  mediaAssets,
  postTranslations,
  posts,
  type AiJobStatus,
  type AiJobType
} from "@/server/db/schema";
import { saveGeneratedCoverImage } from "@/server/media/upload";

type MediaMetadataJobInput = {
  mediaAssetId: string;
};

type BulkPostSeoJobInput = {
  postIds: string[];
};

type BulkPostSeoJobOutput = {
  updated: number;
};

type BulkPostCoverImagesJobInput = {
  postIds: string[];
  overwriteExisting?: boolean;
  userId?: string;
};

type BulkPostCoverImagesJobOutput = {
  generated: number;
};

type AiJobInputByType = {
  post_draft_rewrite: ChineseDraftCoreInput;
  post_draft_translate: DraftTranslationInput;
  post_draft_metadata: DraftMetadataInput;
  media_metadata: MediaMetadataJobInput;
  bulk_post_seo: BulkPostSeoJobInput;
  bulk_post_cover_images: BulkPostCoverImagesJobInput;
};

type AiJobOutputByType = {
  post_draft_rewrite: ChineseDraftCoreOutput;
  post_draft_translate: DraftTranslationOutput;
  post_draft_metadata: DraftMetadataOutput;
  media_metadata: MediaMetadataOutput;
  bulk_post_seo: BulkPostSeoJobOutput;
  bulk_post_cover_images: BulkPostCoverImagesJobOutput;
};

type SerializedJob = {
  id: string;
  type: AiJobType;
  status: AiJobStatus;
  output: Record<string, unknown> | null;
  error: string;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

const activeJobIds = new Set<string>();

function coverImageCategoryFromSlug(slug: string): CoverImageCategory {
  if (slug === "ai") return "ai";
  if (slug === "infrastructure") return "infrastructure";
  return "blockchain";
}

function mediaSeoTitle(title: string, suffix: string) {
  const value = title.trim();
  return value ? `${value} ${suffix}`.slice(0, 255) : suffix;
}

function mediaSeoDescription(title: string, excerpt: string, fallback: string) {
  const source = excerpt.trim() || title.trim() || fallback;
  return source.slice(0, 500);
}
const STALE_RUNNING_JOB_MS = 15 * 60 * 1000;

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeJob(row: {
  id: string;
  type: string;
  status: string;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): SerializedJob {
  return {
    id: row.id,
    type: row.type as AiJobType,
    status: row.status as AiJobStatus,
    output: row.output,
    error: row.errorMessage ?? "",
    attempts: row.attempts,
    createdAt: row.createdAt.toISOString(),
    startedAt: serializeDate(row.startedAt),
    finishedAt: serializeDate(row.finishedAt)
  };
}

function friendlyJobError(error: unknown) {
  if (error instanceof SourceIngestionError) return error.message;
  if (error instanceof Error && error.name === "AbortError") {
    return "链接读取超时。可以把网页关键信息粘贴到素材框后重试。";
  }
  if (error instanceof Error && error.message.includes("timed out")) {
    return "AI 生成超时。可以稍后重试。";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "AI 任务执行失败。";
}

async function executeMediaMetadataJob({
  mediaAssetId
}: MediaMetadataJobInput): Promise<MediaMetadataOutput> {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaAssetId), isNull(mediaAssets.deletedAt)))
    .limit(1);

  if (!asset) {
    throw new Error("媒体资源不存在或已删除。");
  }

  const metadata = await generateMediaMetadata({
    url: asset.url,
    originalFilename: asset.originalFilename,
    width: asset.width,
    height: asset.height,
    currentAltText: asset.altText,
    currentCaption: asset.caption,
    currentZhAltText: asset.zhAltText,
    currentEnAltText: asset.enAltText,
    currentZhSeoTitle: asset.zhSeoTitle,
    currentZhSeoDescription: asset.zhSeoDescription,
    currentEnSeoTitle: asset.enSeoTitle,
    currentEnSeoDescription: asset.enSeoDescription
  });

  await db
    .update(mediaAssets)
    .set({
      altText: metadata.zhAltText || metadata.enAltText || asset.altText,
      caption: metadata.caption || asset.caption,
      zhAltText: metadata.zhAltText || asset.zhAltText,
      enAltText: metadata.enAltText || asset.enAltText,
      zhSeoTitle: metadata.zhSeoTitle || asset.zhSeoTitle,
      zhSeoDescription: metadata.zhSeoDescription || asset.zhSeoDescription,
      enSeoTitle: metadata.enSeoTitle || asset.enSeoTitle,
      enSeoDescription: metadata.enSeoDescription || asset.enSeoDescription,
      metadata: {
        ...(asset.metadata ?? {}),
        seoSummary: metadata.seoSummary,
        generatedBy: "ai",
        generatedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    })
    .where(eq(mediaAssets.id, mediaAssetId));

  return metadata;
}

async function executeBulkPostSeoJob({
  postIds
}: BulkPostSeoJobInput): Promise<BulkPostSeoJobOutput> {
  const rows = await db
    .select({
      postId: posts.id,
      locale: postTranslations.locale,
      title: postTranslations.title,
      excerpt: postTranslations.excerpt,
      content: postTranslations.content,
      coverImage: posts.coverImage,
      ogImage: postTranslations.ogImage,
      structuredData: postTranslations.structuredData
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(inArray(posts.id, postIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    throw new Error("没有找到可处理的文章。");
  }

  let updated = 0;

  for (const postId of postIds) {
    const translations = rows.filter((row) => row.postId === postId);
    const en = translations.find((row) => row.locale === "en");
    const zh = translations.find((row) => row.locale === "zh");
    if (!en && !zh) continue;

    const suggestion = await generateSeoSuggestion({
      targetType: "post",
      enTitle: en?.title ?? "",
      enDescription: en?.excerpt ?? "",
      enContent: en?.content ?? "",
      zhTitle: zh?.title ?? "",
      zhDescription: zh?.excerpt ?? "",
      zhContent: zh?.content ?? ""
    });

    await db.transaction(async (tx) => {
      if (en) {
        await tx
          .update(postTranslations)
          .set({
            seoTitle: suggestion.en.title,
            seoDescription: suggestion.en.description,
            ogImage: en.ogImage || en.coverImage || "",
            structuredData:
              en.structuredData && Object.keys(en.structuredData).length
                ? en.structuredData
                : suggestion.en.structuredData,
            updatedAt: new Date()
          })
          .where(
            and(eq(postTranslations.postId, postId), eq(postTranslations.locale, "en"))
          );
      }

      if (zh) {
        await tx
          .update(postTranslations)
          .set({
            seoTitle: suggestion.zh.title,
            seoDescription: suggestion.zh.description,
            ogImage: zh.ogImage || zh.coverImage || "",
            structuredData:
              zh.structuredData && Object.keys(zh.structuredData).length
                ? zh.structuredData
                : suggestion.zh.structuredData,
            updatedAt: new Date()
          })
          .where(
            and(eq(postTranslations.postId, postId), eq(postTranslations.locale, "zh"))
          );
      }
    });

    updated += 1;
  }

  return { updated };
}

async function executeBulkPostCoverImagesJob({
  postIds,
  overwriteExisting = false,
  userId
}: BulkPostCoverImagesJobInput): Promise<BulkPostCoverImagesJobOutput> {
  if (!userId) {
    throw new Error("无法确认 AI 封面任务创建人。");
  }

  const rows = await db
    .select({
      postId: posts.id,
      slug: posts.slug,
      coverImage: posts.coverImage,
      categorySlug: categories.slug,
      categoryName: categoryTranslations.name,
      locale: postTranslations.locale,
      title: postTranslations.title,
      excerpt: postTranslations.excerpt
    })
    .from(posts)
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, "zh")
      )
    )
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(inArray(posts.id, postIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    throw new Error("没有找到可生成封面的文章。");
  }

  let generated = 0;

  for (const postId of postIds) {
    const translations = rows.filter((row) => row.postId === postId);
    const first = translations[0];
    if (!first) continue;
    if (!overwriteExisting && first.coverImage) continue;

    const zh = translations.find((row) => row.locale === "zh");
    const en = translations.find((row) => row.locale === "en");
    const source = zh ?? en;
    if (!source?.title) continue;
    const category = coverImageCategoryFromSlug(first.categorySlug);
    const categoryName = first.categoryName ?? first.categorySlug;
    const zhTitle = zh?.title ?? source.title;
    const enTitle = en?.title ?? source.title;
    const zhExcerpt = zh?.excerpt ?? source.excerpt ?? "";
    const enExcerpt = en?.excerpt ?? source.excerpt ?? "";
    const zhAltText = `${zhTitle} 文章封面`;
    const enAltText = `${enTitle} article cover`;
    const zhSeoTitle = mediaSeoTitle(zhTitle, "文章封面");
    const enSeoTitle = mediaSeoTitle(enTitle, "Article Cover");
    const zhSeoDescription = mediaSeoDescription(
      zhTitle,
      zhExcerpt,
      `${zhTitle} 的文章封面图。`
    );
    const enSeoDescription = mediaSeoDescription(
      enTitle,
      enExcerpt,
      `Article cover image for ${enTitle}.`
    );

    const image = await generatePostCoverImage({
      title: source.title,
      description: source.excerpt,
      category,
      categoryName
    });
    const caption = `AI 生成封面：${zhTitle}`;
    const asset = await saveGeneratedCoverImage({
      buffer: image.buffer,
      mimeType: image.mimeType,
      originalFilename: `${first.slug}-ai-cover`,
      altText: zhAltText,
      caption,
      zhAltText,
      enAltText,
      zhSeoTitle,
      zhSeoDescription,
      enSeoTitle,
      enSeoDescription,
      userId,
      metadata: {
        generatedBy: "ai",
        generatedAt: new Date().toISOString(),
        generationType: "post_cover",
        prompt: image.prompt,
        model: image.model,
        seoSummary: zhSeoDescription,
        category,
        categoryName,
        postId
      }
    });

    await db
      .update(posts)
      .set({
        coverImage: asset.url,
        coverImageId: asset.id,
        updatedAt: new Date()
      })
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));

    generated += 1;
  }

  return { generated };
}

async function executeJob<TType extends AiJobType>(
  type: TType,
  input: AiJobInputByType[TType]
): Promise<AiJobOutputByType[TType]> {
  if (type === "post_draft_rewrite") {
    const rewriteInput = input as AiJobInputByType["post_draft_rewrite"];
    const source = await fetchAiDraftSource(rewriteInput.sourceUrl?.trim() ?? "");
    return generateChineseDraftCore({
      ...rewriteInput,
      ...source
    }) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "post_draft_translate") {
    return translateDraftToEnglish(
      input as AiJobInputByType["post_draft_translate"]
    ) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "media_metadata") {
    return executeMediaMetadataJob(
      input as AiJobInputByType["media_metadata"]
    ) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "bulk_post_seo") {
    return executeBulkPostSeoJob(
      input as AiJobInputByType["bulk_post_seo"]
    ) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "bulk_post_cover_images") {
    return executeBulkPostCoverImagesJob(
      input as AiJobInputByType["bulk_post_cover_images"]
    ) as Promise<AiJobOutputByType[TType]>;
  }

  return generateDraftMetadata(
    input as AiJobInputByType["post_draft_metadata"]
  ) as Promise<AiJobOutputByType[TType]>;
}

async function runAiJob(jobId: string) {
  if (activeJobIds.has(jobId)) return;
  activeJobIds.add(jobId);

  try {
    const [job] = await db
      .select({
        id: aiJobs.id,
        type: aiJobs.type,
        status: aiJobs.status,
        input: aiJobs.input,
        attempts: aiJobs.attempts,
        createdBy: aiJobs.createdBy
      })
      .from(aiJobs)
      .where(eq(aiJobs.id, jobId))
      .limit(1);

    if (!job || !["queued", "failed"].includes(job.status)) return;

    const startedAt = new Date();
    await db
      .update(aiJobs)
      .set({
        status: "running",
        attempts: job.attempts + 1,
        errorMessage: null,
        startedAt,
        finishedAt: null,
        updatedAt: startedAt
      })
      .where(eq(aiJobs.id, jobId));

    try {
      const output = await executeJob(
        job.type as AiJobType,
        {
          ...toRecord(job.input),
          userId: job.createdBy ?? undefined
        } as AiJobInputByType[AiJobType]
      );
      const finishedAt = new Date();
      await db
        .update(aiJobs)
        .set({
          status: "succeeded",
          output: output as Record<string, unknown>,
          errorMessage: null,
          finishedAt,
          updatedAt: finishedAt
        })
        .where(eq(aiJobs.id, jobId));
    } catch (error) {
      const finishedAt = new Date();
      await db
        .update(aiJobs)
        .set({
          status: "failed",
          errorMessage: friendlyJobError(error),
          finishedAt,
          updatedAt: finishedAt
        })
        .where(eq(aiJobs.id, jobId));
    }
  } finally {
    activeJobIds.delete(jobId);
  }
}

function startJob(jobId: string) {
  void runAiJob(jobId).catch((error) => {
    console.error("AI job runner crashed", error);
  });
}

async function resumeJobIfRecoverable(job: {
  id: string;
  status: string;
  startedAt: Date | null;
}) {
  if (job.status === "queued") {
    startJob(job.id);
    return;
  }

  if (
    job.status === "running" &&
    job.startedAt &&
    Date.now() - job.startedAt.getTime() > STALE_RUNNING_JOB_MS &&
    !activeJobIds.has(job.id)
  ) {
    await db
      .update(aiJobs)
      .set({
        status: "queued",
        errorMessage: "任务执行进程已重启，已自动重新排队。",
        finishedAt: null,
        updatedAt: new Date()
      })
      .where(eq(aiJobs.id, job.id));
    startJob(job.id);
  }
}

export async function createAiJob<TType extends AiJobType>({
  type,
  input,
  userId
}: {
  type: TType;
  input: AiJobInputByType[TType];
  userId: string;
}) {
  const [job] = await db
    .insert(aiJobs)
    .values({
      type,
      input: input as Record<string, unknown>,
      createdBy: userId
    })
    .returning({
      id: aiJobs.id,
      type: aiJobs.type,
      status: aiJobs.status,
      output: aiJobs.output,
      errorMessage: aiJobs.errorMessage,
      attempts: aiJobs.attempts,
      createdAt: aiJobs.createdAt,
      startedAt: aiJobs.startedAt,
      finishedAt: aiJobs.finishedAt
    });

  startJob(job.id);
  return serializeJob(job);
}

export async function getAiJobForUser(jobId: string, user: CurrentUser) {
  const filters = [eq(aiJobs.id, jobId)];
  if (user.role !== "admin") {
    filters.push(eq(aiJobs.createdBy, user.id));
  }

  const [job] = await db
    .select({
      id: aiJobs.id,
      type: aiJobs.type,
      status: aiJobs.status,
      output: aiJobs.output,
      errorMessage: aiJobs.errorMessage,
      attempts: aiJobs.attempts,
      createdAt: aiJobs.createdAt,
      startedAt: aiJobs.startedAt,
      finishedAt: aiJobs.finishedAt
    })
    .from(aiJobs)
    .where(and(...filters))
    .limit(1);

  if (!job) return null;
  await resumeJobIfRecoverable(job);
  return serializeJob(job);
}

export async function retryAiJobForUser(jobId: string, user: CurrentUser) {
  const filters = [eq(aiJobs.id, jobId), eq(aiJobs.status, "failed")];
  if (user.role !== "admin") {
    filters.push(eq(aiJobs.createdBy, user.id));
  }

  const [job] = await db
    .update(aiJobs)
    .set({
      status: "queued",
      errorMessage: null,
      finishedAt: null,
      updatedAt: new Date()
    })
    .where(and(...filters))
    .returning({
      id: aiJobs.id,
      type: aiJobs.type,
      status: aiJobs.status,
      output: aiJobs.output,
      errorMessage: aiJobs.errorMessage,
      attempts: aiJobs.attempts,
      createdAt: aiJobs.createdAt,
      startedAt: aiJobs.startedAt,
      finishedAt: aiJobs.finishedAt
    });

  if (!job) return null;
  startJob(job.id);
  return serializeJob(job);
}
