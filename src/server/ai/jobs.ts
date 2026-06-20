import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql
} from "drizzle-orm";

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
  type AiDraftSource,
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
  postTags,
  posts,
  users,
  type AiJobStatus,
  type AiJobType
} from "@/server/db/schema";
import { aiAuthorValues } from "@/server/content/ai-author";
import {
  fallbackSlug,
  readingMinutesForContent
} from "@/server/content/normalizers";
import {
  deriveLegacyPostFlags,
  emptyPostPlacements
} from "@/server/content/placements";
import { upsertPostTranslation } from "@/server/content/translations";
import {
  regenerateMediaAssetVariants,
  saveGeneratedCoverImage
} from "@/server/media/upload";
import { getAiJobSettings } from "@/server/settings/service";

type MediaMetadataJobInput = {
  mediaAssetId: string;
};

type BulkMediaMetadataJobInput = {
  mediaAssetIds: string[];
  userId?: string;
  jobId?: string;
};

type BulkPostSeoJobInput = {
  postIds: string[];
};

type BulkPostSeoJobOutput = {
  updated: number;
};

type BulkMediaMetadataItemStatus =
  | "pending"
  | "running"
  | "updated"
  | "skipped"
  | "failed";

type BulkMediaMetadataJobOutput = {
  updated: number;
  total?: number;
  processed?: number;
  skipped?: number;
  failed?: number;
  currentAssetId?: string;
  currentLabel?: string;
  items?: Array<{
    mediaAssetId: string;
    label: string;
    status: BulkMediaMetadataItemStatus;
    message?: string;
  }>;
};

type MediaAssetForMetadata = typeof mediaAssets.$inferSelect;

type BulkPostCoverImagesJobInput = {
  postIds: string[];
  overwriteExisting?: boolean;
  userId?: string;
  jobId?: string;
};

type PostDraftCreateJobInput = ChineseDraftCoreInput & {
  categoryId: string;
  tagIds?: string[];
  userId?: string;
  jobId?: string;
};

type PostDraftCreateStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

type PostDraftCreateStepKey =
  | "source"
  | "chinese"
  | "english"
  | "metadata"
  | "database"
  | "cover";

type PostDraftCreateJobOutput = {
  postId?: string;
  postEditUrl?: string;
  coverJobId?: string;
  currentStep?: PostDraftCreateStepKey | "";
  message?: string;
  source?: AiDraftSource;
  zh?: ChineseDraftCoreOutput["zh"];
  en?: DraftTranslationOutput["en"];
  metadata?: DraftMetadataOutput;
  steps: Array<{
    key: PostDraftCreateStepKey;
    label: string;
    status: PostDraftCreateStepStatus;
    message?: string;
  }>;
};

type BulkPostCoverImageItemStatus =
  | "pending"
  | "running"
  | "generated"
  | "skipped"
  | "failed";

type BulkPostCoverImagesJobOutput = {
  generated: number;
  total?: number;
  processed?: number;
  skipped?: number;
  currentPostId?: string;
  currentTitle?: string;
  items?: Array<{
    postId: string;
    title: string;
    status: BulkPostCoverImageItemStatus;
    message?: string;
  }>;
};

type AiJobInputByType = {
  post_draft_rewrite: ChineseDraftCoreInput;
  post_draft_translate: DraftTranslationInput;
  post_draft_metadata: DraftMetadataInput;
  post_draft_create: PostDraftCreateJobInput;
  media_metadata: MediaMetadataJobInput;
  bulk_media_metadata: BulkMediaMetadataJobInput;
  bulk_post_seo: BulkPostSeoJobInput;
  bulk_post_cover_images: BulkPostCoverImagesJobInput;
};

type AiJobOutputByType = {
  post_draft_rewrite: ChineseDraftCoreOutput;
  post_draft_translate: DraftTranslationOutput;
  post_draft_metadata: DraftMetadataOutput;
  post_draft_create: PostDraftCreateJobOutput;
  media_metadata: MediaMetadataOutput;
  bulk_media_metadata: BulkMediaMetadataJobOutput;
  bulk_post_seo: BulkPostSeoJobOutput;
  bulk_post_cover_images: BulkPostCoverImagesJobOutput;
};

type SerializedJob = {
  id: string;
  type: AiJobType;
  status: AiJobStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string;
  attempts: number;
  createdBy: string | null;
  creatorName: string;
  creatorEmail: string;
  relatedPostIds: string[];
  relatedPostTitle: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type SerializedJobDetail = SerializedJob & {
  input: Record<string, unknown>;
};

export const aiJobTypeValues = [
  "post_draft_rewrite",
  "post_draft_translate",
  "post_draft_metadata",
  "post_draft_create",
  "media_metadata",
  "bulk_media_metadata",
  "bulk_post_seo",
  "bulk_post_cover_images"
] as const satisfies AiJobType[];

export const aiJobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed"
] as const satisfies AiJobStatus[];

const singleAiJobCleanupTypes = [
  "post_draft_rewrite",
  "post_draft_translate",
  "post_draft_metadata",
  "post_draft_create",
  "media_metadata"
] as const satisfies AiJobType[];

const bulkAiJobCleanupTypes = [
  "bulk_media_metadata",
  "bulk_post_seo",
  "bulk_post_cover_images"
] as const satisfies AiJobType[];

const activeJobIds = new Set<string>();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const postDraftCreateStepDefinitions: Array<{
  key: PostDraftCreateStepKey;
  label: string;
}> = [
  { key: "source", label: "读取素材" },
  { key: "chinese", label: "生成中文稿" },
  { key: "english", label: "生成英文稿" },
  { key: "metadata", label: "生成 Slug 和 SEO" },
  { key: "database", label: "写入草稿" },
  { key: "cover", label: "排队生成封面" }
];

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
const AI_JOB_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
let lastExpiredAiJobCleanupAt = 0;
let expiredAiJobCleanupPromise: Promise<AiJobCleanupResult> | null = null;

export type AiJobCleanupResult = {
  skipped: boolean;
  succeededSingleDeleted: number;
  succeededBulkDeleted: number;
  failedDeleted: number;
};

function emptyAiJobCleanupResult(skipped: boolean): AiJobCleanupResult {
  return {
    skipped,
    succeededSingleDeleted: 0,
    succeededBulkDeleted: 0,
    failedDeleted: 0
  };
}

function daysBeforeNow(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

function defaultPostDraftCreateOutput(): PostDraftCreateJobOutput {
  return {
    currentStep: "",
    message: "等待开始。",
    steps: postDraftCreateStepDefinitions.map((step) => ({
      ...step,
      status: "pending"
    }))
  };
}

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
  input?: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  createdBy?: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): SerializedJob {
  const input = row.input ?? null;
  const output = row.output ?? null;

  return {
    id: row.id,
    type: row.type as AiJobType,
    status: row.status as AiJobStatus,
    input,
    output,
    error: row.errorMessage ?? "",
    attempts: row.attempts,
    createdBy: row.createdBy ?? null,
    creatorName: row.creatorName ?? "",
    creatorEmail: row.creatorEmail ?? "",
    relatedPostIds: relatedPostIdsFromJob(input, output),
    relatedPostTitle: relatedPostTitleFromJob(input, output),
    createdAt: row.createdAt.toISOString(),
    startedAt: serializeDate(row.startedAt),
    finishedAt: serializeDate(row.finishedAt)
  };
}

function serializeJobDetail(row: {
  id: string;
  type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): SerializedJobDetail {
  return {
    ...serializeJob(row),
    input: row.input
  };
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
}

function relatedPostIdsFromJob(
  input: Record<string, unknown> | null,
  output: Record<string, unknown> | null
) {
  const ids = new Set<string>();
  const inputRecord = toRecord(input);
  const outputRecord = toRecord(output);

  for (const id of stringList(inputRecord.postIds)) ids.add(id);
  if (typeof inputRecord.postId === "string") ids.add(inputRecord.postId);
  if (typeof outputRecord.postId === "string") ids.add(outputRecord.postId);

  const items = Array.isArray(outputRecord.items) ? outputRecord.items : [];
  for (const item of items) {
    const itemRecord = toRecord(item);
    if (typeof itemRecord.postId === "string") ids.add(itemRecord.postId);
  }

  return Array.from(ids);
}

function relatedPostTitleFromJob(
  input: Record<string, unknown> | null,
  output: Record<string, unknown> | null
) {
  const inputRecord = toRecord(input);
  const outputRecord = toRecord(output);
  const zh = toRecord(outputRecord.zh);
  const en = toRecord(outputRecord.en);
  const metadata = toRecord(outputRecord.metadata);

  return (
    [
      outputRecord.currentTitle,
      zh.title,
      en.title,
      metadata.slug,
      inputRecord.zhTitle,
      inputRecord.title,
      inputRecord.sourceTitle
    ].find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    ) ?? ""
  );
}

function normalizePostDraftCreateOutput(
  value: Record<string, unknown> | null | undefined
): PostDraftCreateJobOutput {
  const source = toRecord(value);
  const fallback = defaultPostDraftCreateOutput();
  const storedSteps = Array.isArray(source.steps) ? source.steps : [];

  return {
    ...fallback,
    ...source,
    postId: typeof source.postId === "string" ? source.postId : undefined,
    postEditUrl:
      typeof source.postEditUrl === "string" ? source.postEditUrl : undefined,
    coverJobId:
      typeof source.coverJobId === "string" ? source.coverJobId : undefined,
    currentStep:
      typeof source.currentStep === "string"
        ? (source.currentStep as PostDraftCreateStepKey | "")
        : "",
    message: typeof source.message === "string" ? source.message : fallback.message,
    source: toRecord(source.source) as AiDraftSource,
    zh: toRecord(source.zh) as ChineseDraftCoreOutput["zh"],
    en: toRecord(source.en) as DraftTranslationOutput["en"],
    metadata: toRecord(source.metadata) as DraftMetadataOutput,
    steps: postDraftCreateStepDefinitions.map((definition) => {
      const stored = storedSteps
        .map((step) => toRecord(step))
        .find((step) => step.key === definition.key);
      const status =
        stored?.status === "running" ||
        stored?.status === "succeeded" ||
        stored?.status === "failed" ||
        stored?.status === "skipped"
          ? stored.status
          : "pending";

      return {
        ...definition,
        status,
        message: typeof stored?.message === "string" ? stored.message : undefined
      };
    })
  };
}

function setPostDraftCreateStep(
  output: PostDraftCreateJobOutput,
  key: PostDraftCreateStepKey,
  status: PostDraftCreateStepStatus,
  message?: string
) {
  return {
    ...output,
    currentStep: status === "running" ? key : output.currentStep,
    message: message ?? output.message,
    steps: output.steps.map((step) =>
      step.key === key
        ? {
            ...step,
            status,
            message
          }
        : step
    )
  };
}

function hasChineseDraft(
  value: PostDraftCreateJobOutput["zh"]
): value is NonNullable<PostDraftCreateJobOutput["zh"]> {
  return Boolean(value?.title?.trim() && value.content?.trim());
}

function hasEnglishDraft(
  value: PostDraftCreateJobOutput["en"]
): value is NonNullable<PostDraftCreateJobOutput["en"]> {
  return Boolean(value?.title?.trim() && value.content?.trim());
}

function hasDraftMetadata(
  value: PostDraftCreateJobOutput["metadata"]
): value is NonNullable<PostDraftCreateJobOutput["metadata"]> {
  return Boolean(
    value?.slug?.trim() &&
      value.zh?.seoTitle?.trim() &&
      value.en?.seoTitle?.trim()
  );
}

function structuredDataObject(value: Record<string, unknown> | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function uniquePostSlug(candidateSlug: string, fallbackTitle: string) {
  const base = fallbackSlug(candidateSlug || fallbackTitle).slice(0, 220);
  let slug = base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const [existing] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!existing) return slug;

    slug = `${base}-${suffix}`.slice(0, 255);
  }

  return `${base}-${Date.now()}`.slice(0, 255);
}

function friendlyJobError(error: unknown) {
  if (error instanceof SourceIngestionError) return error.message;
  if (error instanceof Error && error.name === "AbortError") {
    return "链接读取超时。可以把网页关键信息粘贴到素材框后重试。";
  }
  if (
    error instanceof Error &&
    error.message.includes("No available compatible accounts")
  ) {
    return "图片生成供应商没有可用的兼容账号。请检查设置里的图片 API Key、Base URL、模型名和供应商账号额度，或更换可用的生图模型后重试。";
  }
  if (
    error instanceof Error &&
    error.message.includes("image generation failed: 503")
  ) {
    return "图片生成供应商暂时不可用或账号不可用。请检查图片生成配置、账号额度和模型可用性后重试。";
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

  return updateMediaAssetWithAiMetadata(asset);
}

async function updateMediaAssetWithAiMetadata(
  asset: MediaAssetForMetadata
): Promise<MediaMetadataOutput> {
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
    .where(eq(mediaAssets.id, asset.id));

  return metadata;
}

function mediaAssetLabel(asset: Pick<MediaAssetForMetadata, "originalFilename" | "zhAltText" | "altText" | "enAltText" | "url">) {
  return (
    asset.zhAltText ||
    asset.altText ||
    asset.enAltText ||
    asset.originalFilename ||
    asset.url
  );
}

async function executeBulkMediaMetadataJob({
  mediaAssetIds,
  jobId
}: BulkMediaMetadataJobInput): Promise<BulkMediaMetadataJobOutput> {
  const uniqueIds = Array.from(new Set(mediaAssetIds)).slice(0, 50);
  if (!uniqueIds.length) {
    throw new Error("请选择需要补全的媒体资源。");
  }

  const assets = await db
    .select()
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.id, uniqueIds), isNull(mediaAssets.deletedAt)));

  if (!assets.length) {
    throw new Error("没有找到可补全的媒体资源。");
  }

  const items: NonNullable<BulkMediaMetadataJobOutput["items"]> = uniqueIds.map((id) => {
    const asset = assets.find((item) => item.id === id);
    return {
      mediaAssetId: id,
      label: asset ? mediaAssetLabel(asset) : id,
      status: asset ? "pending" : "skipped",
      message: asset ? undefined : "媒体资源不存在或已删除。"
    };
  });
  let updated = 0;
  let skipped = items.filter((item) => item.status === "skipped").length;
  let failed = 0;
  let processed = skipped;

  const writeProgress = async (
    status: BulkMediaMetadataItemStatus,
    currentAssetId?: string,
    currentLabel?: string
  ) => {
    if (!jobId) return;

    await db
      .update(aiJobs)
      .set({
        output: {
          updated,
          skipped,
          failed,
          processed,
          total: items.length,
          currentAssetId: currentAssetId ?? "",
          currentLabel: currentLabel ?? "",
          status,
          items
        },
        updatedAt: new Date()
      })
      .where(eq(aiJobs.id, jobId));
  };

  await writeProgress("pending");

  for (const asset of assets) {
    const item = items.find((value) => value.mediaAssetId === asset.id);
    if (!item) continue;

    item.status = "running";
    item.message = "正在生成双语替代文本和 SEO。";
    await writeProgress("running", asset.id, item.label);

    try {
      await updateMediaAssetWithAiMetadata(asset);

      if (
        asset.storageProvider === "local" &&
        asset.storageKey &&
        (!asset.variants || asset.variants.length === 0)
      ) {
        const variants = await regenerateMediaAssetVariants({
          storageKey: asset.storageKey
        });
        await db
          .update(mediaAssets)
          .set({ variants, updatedAt: new Date() })
          .where(eq(mediaAssets.id, asset.id));
      }

      updated += 1;
      processed += 1;
      item.status = "updated";
      item.message = "媒体 SEO 已补全。";
      await writeProgress("updated", asset.id, item.label);
    } catch (error) {
      failed += 1;
      processed += 1;
      item.status = "failed";
      item.message = friendlyJobError(error);
      await writeProgress("failed", asset.id, item.label);
    }
  }

  return {
    updated,
    skipped,
    failed,
    processed,
    total: items.length,
    currentAssetId: "",
    currentLabel: "",
    items
  };
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

async function createDraftPostFromAiOutput({
  input,
  output
}: {
  input: PostDraftCreateJobInput;
  output: PostDraftCreateJobOutput;
}) {
  if (!input.userId) {
    throw new Error("无法确认文章创建人。请重新登录后再试。");
  }

  const zh = output.zh;
  const en = output.en;
  const metadata = output.metadata;

  if (!hasChineseDraft(zh)) {
    throw new Error("中文稿还没有生成，不能写入草稿。");
  }

  if (!hasEnglishDraft(en)) {
    throw new Error("英文稿还没有生成，不能写入草稿。");
  }

  if (!hasDraftMetadata(metadata)) {
    throw new Error("Slug 和 SEO 还没有生成，不能写入草稿。");
  }

  const legacyFlags = deriveLegacyPostFlags(emptyPostPlacements(), "");
  const slug = await uniquePostSlug(metadata.slug, en.title);
  const tagIds = Array.from(new Set(input.tagIds ?? [])).slice(0, 30);

  const [created] = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        slug,
        categoryId: input.categoryId,
        authorId: input.userId,
        status: "draft",
        mark: legacyFlags.mark,
        ...aiAuthorValues(input.writingRole),
        coverImage: "",
        coverImageId: null,
        publishedAt: null,
        featured: legacyFlags.featured,
        pinned: legacyFlags.pinned,
        sortOrder: 0
      })
      .returning({ id: posts.id });

    await upsertPostTranslation(tx, post.id, "zh", {
      title: zh.title,
      excerpt: zh.excerpt,
      content: zh.content,
      readingMinutes: readingMinutesForContent(zh.content, "zh"),
      seoTitle: metadata.zh.seoTitle,
      seoDescription: metadata.zh.seoDescription,
      canonicalUrl: "",
      ogImage: "",
      structuredData: structuredDataObject(metadata.zh.structuredData)
    });
    await upsertPostTranslation(tx, post.id, "en", {
      title: en.title,
      excerpt: en.excerpt,
      content: en.content,
      readingMinutes: readingMinutesForContent(en.content, "en"),
      seoTitle: metadata.en.seoTitle,
      seoDescription: metadata.en.seoDescription,
      canonicalUrl: "",
      ogImage: "",
      structuredData: structuredDataObject(metadata.en.structuredData)
    });

    if (tagIds.length) {
      await tx
        .insert(postTags)
        .values(tagIds.map((tagId) => ({ postId: post.id, tagId })));
    }

    return [post];
  });

  return created.id;
}

async function executePostDraftCreateJob(
  input: PostDraftCreateJobInput,
  previousOutput?: Record<string, unknown> | null
): Promise<PostDraftCreateJobOutput> {
  if (!input.userId) {
    throw new Error("无法确认文章创建人。请重新登录后再试。");
  }

  if (!input.jobId) {
    throw new Error("无法确认 AI 任务编号。");
  }

  let output = normalizePostDraftCreateOutput(previousOutput);

  const writeOutput = async (
    nextOutput: PostDraftCreateJobOutput,
    extra?: Partial<PostDraftCreateJobOutput>
  ) => {
    output = {
      ...nextOutput,
      ...extra
    };
    await db
      .update(aiJobs)
      .set({
        output: output as unknown as Record<string, unknown>,
        updatedAt: new Date()
      })
      .where(eq(aiJobs.id, input.jobId ?? ""));
  };

  if (!output.source || Object.keys(output.source).length === 0) {
    const sourceUrl = input.sourceUrl?.trim() ?? "";

    if (!sourceUrl) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "source",
          "skipped",
          "未提供链接，使用粘贴素材。"
        ),
        { source: { sourceUrl: "" } }
      );
    } else {
      await writeOutput(
        setPostDraftCreateStep(output, "source", "running", "正在读取链接素材。")
      );
      try {
        const source = await fetchAiDraftSource(sourceUrl);
        await writeOutput(
          setPostDraftCreateStep(output, "source", "succeeded", "素材读取完成。"),
          { source }
        );
      } catch (error) {
        await writeOutput(
          setPostDraftCreateStep(
            output,
            "source",
            "failed",
            friendlyJobError(error)
          )
        );
        throw error;
      }
    }
  }

  if (!hasChineseDraft(output.zh)) {
    await writeOutput(
      setPostDraftCreateStep(output, "chinese", "running", "正在生成中文草稿。")
    );
    try {
      const zh = await generateChineseDraftCore({
        writingRole: input.writingRole,
        rawInput: input.rawInput,
        sourceUrl: input.sourceUrl,
        ...(output.source ?? {})
      });
      await writeOutput(
        setPostDraftCreateStep(output, "chinese", "succeeded", "中文草稿已生成。"),
        { zh: zh.zh }
      );
    } catch (error) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "chinese",
          "failed",
          friendlyJobError(error)
        )
      );
      throw error;
    }
  }

  if (!hasEnglishDraft(output.en)) {
    await writeOutput(
      setPostDraftCreateStep(output, "english", "running", "正在生成英文稿。")
    );
    try {
      const en = await translateDraftToEnglish({
        writingRole: input.writingRole,
        zhTitle: output.zh?.title ?? "",
        zhExcerpt: output.zh?.excerpt ?? "",
        zhContent: output.zh?.content ?? ""
      });
      await writeOutput(
        setPostDraftCreateStep(output, "english", "succeeded", "英文稿已生成。"),
        { en: en.en }
      );
    } catch (error) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "english",
          "failed",
          friendlyJobError(error)
        )
      );
      throw error;
    }
  }

  if (!hasDraftMetadata(output.metadata)) {
    await writeOutput(
      setPostDraftCreateStep(
        output,
        "metadata",
        "running",
        "正在生成 Slug 和双语 SEO。"
      )
    );
    try {
      const metadata = await generateDraftMetadata({
        writingRole: input.writingRole,
        zhTitle: output.zh?.title ?? "",
        zhExcerpt: output.zh?.excerpt ?? "",
        zhContent: output.zh?.content ?? "",
        enTitle: output.en?.title ?? "",
        enExcerpt: output.en?.excerpt ?? "",
        enContent: output.en?.content ?? ""
      });
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "metadata",
          "succeeded",
          "Slug 和双语 SEO 已生成。"
        ),
        { metadata }
      );
    } catch (error) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "metadata",
          "failed",
          friendlyJobError(error)
        )
      );
      throw error;
    }
  }

  if (!output.postId) {
    await writeOutput(
      setPostDraftCreateStep(output, "database", "running", "正在写入文章草稿。")
    );
    try {
      const postId = await createDraftPostFromAiOutput({ input, output });
      await writeOutput(
        setPostDraftCreateStep(output, "database", "succeeded", "草稿已写入数据库。"),
        {
          postId,
          postEditUrl: `/posts/${postId}/edit`
        }
      );
    } catch (error) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "database",
          "failed",
          friendlyJobError(error)
        )
      );
      throw error;
    }
  }

  if (!output.coverJobId && output.postId) {
    await writeOutput(
      setPostDraftCreateStep(output, "cover", "running", "正在排队生成封面。")
    );
    try {
      const coverJob = await createAiJob({
        type: "bulk_post_cover_images",
        input: {
          postIds: [output.postId],
          overwriteExisting: false
        },
        userId: input.userId
      });
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "cover",
          "succeeded",
          "封面生成任务已提交。"
        ),
        {
          coverJobId: coverJob.id,
          currentStep: "",
          message: "文章草稿已创建，封面生成任务已提交。"
        }
      );
    } catch (error) {
      await writeOutput(
        setPostDraftCreateStep(
          output,
          "cover",
          "failed",
          friendlyJobError(error)
        ),
        {
          message:
            "文章草稿已创建，但封面任务提交失败。可进入文章编辑页或媒体库重新生成封面。"
        }
      );
      throw error;
    }
  }

  return {
    ...output,
    currentStep: "",
    message: output.message || "文章草稿已创建。"
  };
}

async function executeBulkPostCoverImagesJob({
  postIds,
  overwriteExisting = false,
  userId,
  jobId
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

  const candidates = postIds
    .map((postId) => {
      const translations = rows.filter((row) => row.postId === postId);
      const first = translations[0];
      const zh = translations.find((row) => row.locale === "zh");
      const en = translations.find((row) => row.locale === "en");
      const source = zh ?? en;

      return first && source?.title
        ? {
            postId,
            translations,
            first,
            zh,
            en,
            source,
            title: source.title
          }
        : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const items: NonNullable<BulkPostCoverImagesJobOutput["items"]> =
    candidates.map((candidate) => ({
      postId: candidate.postId,
      title: candidate.title,
      status:
        !overwriteExisting && candidate.first.coverImage ? "skipped" : "pending",
      message:
        !overwriteExisting && candidate.first.coverImage
          ? "已有封面，已跳过。"
          : undefined
    }));
  let generated = 0;
  let skipped = items.filter((item) => item.status === "skipped").length;
  let processed = skipped;

  const writeProgress = async (
    status: BulkPostCoverImageItemStatus,
    currentPostId?: string,
    currentTitle?: string
  ) => {
    if (!jobId) return;

    await db
      .update(aiJobs)
      .set({
        output: {
          generated,
          skipped,
          processed,
          total: items.length,
          currentPostId: currentPostId ?? "",
          currentTitle: currentTitle ?? "",
          status,
          items
        },
        updatedAt: new Date()
      })
      .where(eq(aiJobs.id, jobId));
  };

  await writeProgress("pending");

  for (const candidate of candidates) {
    const { postId, translations, first, zh, en, source } = candidate;
    const item = items.find((value) => value.postId === postId);
    if (!item) continue;
    if (!overwriteExisting && first.coverImage) continue;

    item.status = "running";
    item.message = "正在生成封面。";
    await writeProgress("running", postId, candidate.title);

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
        generationPreset: image.preset,
        prompt: image.prompt,
        model: image.model,
        sourceMimeType: image.mimeType,
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
    processed += 1;
    item.status = "generated";
    item.message = "封面已生成并写入媒体库。";
    await writeProgress("generated", postId, candidate.title);
  }

  return {
    generated,
    skipped,
    processed,
    total: items.length,
    currentPostId: "",
    currentTitle: "",
    items
  };
}

async function executeJob<TType extends AiJobType>(
  type: TType,
  input: AiJobInputByType[TType],
  previousOutput?: Record<string, unknown> | null
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

  if (type === "post_draft_create") {
    return executePostDraftCreateJob(
      input as AiJobInputByType["post_draft_create"],
      previousOutput
    ) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "media_metadata") {
    return executeMediaMetadataJob(
      input as AiJobInputByType["media_metadata"]
    ) as Promise<AiJobOutputByType[TType]>;
  }

  if (type === "bulk_media_metadata") {
    return executeBulkMediaMetadataJob(
      input as AiJobInputByType["bulk_media_metadata"]
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
        output: aiJobs.output,
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
          userId: job.createdBy ?? undefined,
          jobId: job.id
        } as AiJobInputByType[AiJobType],
        job.output
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

export async function getAiJobDetailForUser(jobId: string, user: CurrentUser) {
  const filters = [eq(aiJobs.id, jobId)];
  if (user.role !== "admin") {
    filters.push(eq(aiJobs.createdBy, user.id));
  }

  const [job] = await db
    .select({
      id: aiJobs.id,
      type: aiJobs.type,
      status: aiJobs.status,
      input: aiJobs.input,
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
  return serializeJobDetail(job);
}

async function deleteExpiredAiJobs() {
  const settings = await getAiJobSettings();
  const now = new Date();
  const singleSucceededCutoff = daysBeforeNow(
    settings.succeededSingleRetentionDays
  );
  const bulkSucceededCutoff = daysBeforeNow(settings.succeededBulkRetentionDays);
  const failedCutoff = daysBeforeNow(settings.failedRetentionDays);
  const [singleSucceededDeleted, bulkSucceededDeleted, failedDeleted] =
    await db.transaction(async (tx) => {
      const singleRows = await tx
        .delete(aiJobs)
        .where(
          and(
            eq(aiJobs.status, "succeeded"),
            inArray(aiJobs.type, singleAiJobCleanupTypes),
            lt(aiJobs.finishedAt, singleSucceededCutoff)
          )
        )
        .returning({ id: aiJobs.id });
      const bulkRows = await tx
        .delete(aiJobs)
        .where(
          and(
            eq(aiJobs.status, "succeeded"),
            inArray(aiJobs.type, bulkAiJobCleanupTypes),
            lt(aiJobs.finishedAt, bulkSucceededCutoff)
          )
        )
        .returning({ id: aiJobs.id });
      const failedRows = await tx
        .delete(aiJobs)
        .where(and(eq(aiJobs.status, "failed"), lt(aiJobs.finishedAt, failedCutoff)))
        .returning({ id: aiJobs.id });

      return [singleRows.length, bulkRows.length, failedRows.length];
    });

  lastExpiredAiJobCleanupAt = now.getTime();

  return {
    skipped: false,
    succeededSingleDeleted: singleSucceededDeleted,
    succeededBulkDeleted: bulkSucceededDeleted,
    failedDeleted
  };
}

export async function cleanupExpiredAiJobsIfDue({
  force = false
}: {
  force?: boolean;
} = {}) {
  const now = Date.now();
  if (!force && now - lastExpiredAiJobCleanupAt < AI_JOB_CLEANUP_INTERVAL_MS) {
    return emptyAiJobCleanupResult(true);
  }

  if (expiredAiJobCleanupPromise) {
    return expiredAiJobCleanupPromise;
  }

  expiredAiJobCleanupPromise = deleteExpiredAiJobs()
    .catch((error) => {
      console.error("AI job cleanup failed", error);
      return emptyAiJobCleanupResult(false);
    })
    .finally(() => {
      expiredAiJobCleanupPromise = null;
    });

  return expiredAiJobCleanupPromise;
}

export async function listAiJobsForUser({
  user,
  type = "all",
  status = "all",
  query = "",
  creatorId = "all",
  createdAfter,
  page = 1,
  pageSize = 20
}: {
  user: CurrentUser;
  type?: AiJobType | "all";
  status?: AiJobStatus | "all";
  query?: string;
  creatorId?: string | "all";
  createdAfter?: Date;
  page?: number;
  pageSize?: number;
}) {
  const safePage = Number.isFinite(page) ? Math.max(page, 1) : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(pageSize, 1), 100)
    : 20;
  const normalizedQuery = query.trim();
  const filters = [
    type === "all" ? undefined : eq(aiJobs.type, type),
    status === "all" ? undefined : eq(aiJobs.status, status),
    user.role !== "admin" ? eq(aiJobs.createdBy, user.id) : undefined,
    user.role === "admin" && creatorId !== "all" && uuidPattern.test(creatorId)
      ? eq(aiJobs.createdBy, creatorId)
      : undefined,
    createdAfter
      ? or(
          gte(aiJobs.createdAt, createdAfter),
          inArray(aiJobs.status, ["queued", "running"])
        )
      : undefined,
    normalizedQuery
      ? or(
          ilike(sql`${aiJobs.input}::text`, `%${normalizedQuery}%`),
          ilike(sql`${aiJobs.output}::text`, `%${normalizedQuery}%`),
          ilike(aiJobs.errorMessage, `%${normalizedQuery}%`),
          ilike(sql`${aiJobs.id}::text`, `%${normalizedQuery}%`)
        )
      : undefined
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: aiJobs.id,
      type: aiJobs.type,
      status: aiJobs.status,
      input: aiJobs.input,
      output: aiJobs.output,
      errorMessage: aiJobs.errorMessage,
      attempts: aiJobs.attempts,
      createdBy: aiJobs.createdBy,
      creatorName: users.name,
      creatorEmail: users.email,
      createdAt: aiJobs.createdAt,
      startedAt: aiJobs.startedAt,
      finishedAt: aiJobs.finishedAt
    })
    .from(aiJobs)
    .leftJoin(users, eq(aiJobs.createdBy, users.id))
    .where(where)
    .orderBy(desc(aiJobs.createdAt))
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);

  const [totalRow] = await db
    .select({ total: count() })
    .from(aiJobs)
    .where(where);

  await Promise.all(
    rows
      .filter((job) => job.status === "queued" || job.status === "running")
      .map((job) => resumeJobIfRecoverable(job))
  );

  return {
    rows: rows.map(serializeJob),
    total: Number(totalRow?.total ?? 0),
    page: safePage,
    pageSize: safePageSize
  };
}

export async function listAiJobCreatorsForUser(user: CurrentUser) {
  if (user.role !== "admin") {
    return [
      {
        id: user.id,
        name: user.name,
        email: user.email
      }
    ];
  }

  return db
    .selectDistinct({
      id: users.id,
      name: users.name,
      email: users.email
    })
    .from(aiJobs)
    .innerJoin(users, eq(aiJobs.createdBy, users.id))
    .orderBy(users.name, users.email);
}

export async function listRecentCoverImageJobsForUser(
  user: CurrentUser,
  limit = 10
) {
  const filters = [eq(aiJobs.type, "bulk_post_cover_images")];
  if (user.role !== "admin") {
    filters.push(eq(aiJobs.createdBy, user.id));
  }

  const rows = await db
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
    .orderBy(desc(aiJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 20));

  return rows.map(serializeJob);
}

export async function listRecentPostDraftJobsForUser(
  user: CurrentUser,
  limit = 50
) {
  const filters = [
    inArray(aiJobs.type, [
      "post_draft_create",
      "post_draft_rewrite",
      "post_draft_translate",
      "post_draft_metadata"
    ])
  ];
  if (user.role !== "admin") {
    filters.push(eq(aiJobs.createdBy, user.id));
  }

  const rows = await db
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
    .orderBy(desc(aiJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map(serializeJob);
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
