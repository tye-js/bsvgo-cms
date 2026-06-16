import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  mediaAssets,
  postTranslations,
  posts
} from "@/server/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function mediaAssetUsedExpression() {
  return sql<boolean>`exists (
    select 1 from ${posts}
    where (
        ${posts.coverImageId} = ${mediaAssets.id}
        or ${posts.coverImage} = ${mediaAssets.url}
      )
      and ${posts.deletedAt} is null
  )`;
}

function mediaAssetUsageCountExpression() {
  return sql<number>`(
    select count(*)::int from ${posts}
    where (
        ${posts.coverImageId} = ${mediaAssets.id}
        or ${posts.coverImage} = ${mediaAssets.url}
      )
      and ${posts.deletedAt} is null
  )`;
}

export async function listMediaAssets(options: {
  query?: string;
  provider?: "all" | "local" | "external_url";
  usage?: "all" | "used" | "unused";
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Number.isFinite(options.page) ? Math.max(options.page ?? 1, 1) : 1;
  const pageSize = Number.isFinite(options.pageSize)
    ? Math.min(Math.max(options.pageSize ?? 24, 1), 100)
    : 24;
  const query = options.query?.trim();
  const provider = options.provider ?? "all";
  const usage = options.usage ?? "all";
  const isUsedExpression = mediaAssetUsedExpression();
  const filters = [
    isNull(mediaAssets.deletedAt),
    provider === "all" ? undefined : eq(mediaAssets.storageProvider, provider),
    usage === "used" ? isUsedExpression : undefined,
    usage === "unused" ? sql`not ${isUsedExpression}` : undefined,
    query
      ? or(
          ilike(mediaAssets.url, `%${query}%`),
          ilike(mediaAssets.altText, `%${query}%`),
          ilike(mediaAssets.caption, `%${query}%`),
          ilike(mediaAssets.zhAltText, `%${query}%`),
          ilike(mediaAssets.enAltText, `%${query}%`),
          ilike(mediaAssets.zhSeoTitle, `%${query}%`),
          ilike(mediaAssets.zhSeoDescription, `%${query}%`),
          ilike(mediaAssets.enSeoTitle, `%${query}%`),
          ilike(mediaAssets.enSeoDescription, `%${query}%`),
          ilike(mediaAssets.originalFilename, `%${query}%`)
        )
      : undefined
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText,
      caption: mediaAssets.caption,
      zhAltText: mediaAssets.zhAltText,
      enAltText: mediaAssets.enAltText,
      zhSeoTitle: mediaAssets.zhSeoTitle,
      zhSeoDescription: mediaAssets.zhSeoDescription,
      enSeoTitle: mediaAssets.enSeoTitle,
      enSeoDescription: mediaAssets.enSeoDescription,
      storageProvider: mediaAssets.storageProvider,
      storageKey: mediaAssets.storageKey,
      originalFilename: mediaAssets.originalFilename,
      checksum: mediaAssets.checksum,
      mimeType: mediaAssets.mimeType,
      width: mediaAssets.width,
      height: mediaAssets.height,
      fileSize: mediaAssets.fileSize,
      variants: mediaAssets.variants,
      metadata: mediaAssets.metadata,
      createdBy: mediaAssets.createdBy,
      createdAt: mediaAssets.createdAt,
      updatedAt: mediaAssets.updatedAt,
      deletedAt: mediaAssets.deletedAt,
      usageCount: mediaAssetUsageCountExpression()
    })
    .from(mediaAssets)
    .where(where)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db
    .select({ total: count() })
    .from(mediaAssets)
    .where(where);

  return {
    rows,
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize
  };
}

export async function getMediaAssetOptions(limit = 80) {
  return db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText,
      caption: mediaAssets.caption,
      zhAltText: mediaAssets.zhAltText,
      enAltText: mediaAssets.enAltText,
      zhSeoTitle: mediaAssets.zhSeoTitle,
      zhSeoDescription: mediaAssets.zhSeoDescription,
      enSeoTitle: mediaAssets.enSeoTitle,
      enSeoDescription: mediaAssets.enSeoDescription,
      storageProvider: mediaAssets.storageProvider,
      width: mediaAssets.width,
      height: mediaAssets.height,
      fileSize: mediaAssets.fileSize,
      variants: mediaAssets.variants,
      createdAt: mediaAssets.createdAt
    })
    .from(mediaAssets)
    .where(isNull(mediaAssets.deletedAt))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit);
}

export async function getPostCoverGenerationOptions(limit = 50) {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      coverImage: posts.coverImage,
      updatedAt: posts.updatedAt,
      categorySlug: categories.slug,
      categoryName: sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), ${categories.slug})`,
      title: sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), ${posts.slug})`
    })
    .from(posts)
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(isNull(posts.deletedAt))
    .groupBy(posts.id, categories.id)
    .orderBy(desc(posts.updatedAt))
    .limit(limit);
}

export async function getMediaAsset(id: string) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .limit(1);

  return asset ?? null;
}

export async function getMediaAssetUsage(id: string) {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      updatedAt: posts.updatedAt,
      title: sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), ${posts.slug})`
    })
    .from(posts)
    .innerJoin(
      mediaAssets,
      and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))
    )
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(
      and(
        or(eq(posts.coverImageId, id), eq(posts.coverImage, mediaAssets.url)),
        isNull(posts.deletedAt)
      )
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.updatedAt));
}

export async function getUnusedMediaAssetIds(ids: string[]) {
  if (!ids.length) return [];

  const rows = await db
    .select({
      id: mediaAssets.id,
      usageCount: mediaAssetUsageCountExpression()
    })
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.id, ids), isNull(mediaAssets.deletedAt)));

  return rows.filter((row) => Number(row.usageCount) === 0).map((row) => row.id);
}

export async function getMediaAssetWithClient(
  client: typeof db | Transaction,
  id: string
) {
  const [asset] = await client
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText,
      caption: mediaAssets.caption,
      zhAltText: mediaAssets.zhAltText,
      enAltText: mediaAssets.enAltText,
      zhSeoTitle: mediaAssets.zhSeoTitle,
      zhSeoDescription: mediaAssets.zhSeoDescription,
      enSeoTitle: mediaAssets.enSeoTitle,
      enSeoDescription: mediaAssets.enSeoDescription
    })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .limit(1);

  return asset ?? null;
}

export async function upsertMediaAssetFromUrl({
  url,
  altText,
  caption,
  zhAltText,
  enAltText,
  zhSeoTitle,
  zhSeoDescription,
  enSeoTitle,
  enSeoDescription,
  userId
}: {
  url: string;
  altText: string;
  caption?: string;
  zhAltText?: string;
  enAltText?: string;
  zhSeoTitle?: string;
  zhSeoDescription?: string;
  enSeoTitle?: string;
  enSeoDescription?: string;
  userId: string;
}) {
  return upsertMediaAssetFromUrlWithClient(db, {
    url,
    altText,
    caption,
    zhAltText,
    enAltText,
    zhSeoTitle,
    zhSeoDescription,
    enSeoTitle,
    enSeoDescription,
    userId
  });
}

export async function upsertMediaAssetFromUrlWithClient(
  client: typeof db | Transaction,
  {
    url,
    altText,
    caption,
    zhAltText,
    enAltText,
    zhSeoTitle,
    zhSeoDescription,
    enSeoTitle,
    enSeoDescription,
    userId
  }: {
    url: string;
    altText: string;
    caption?: string;
    zhAltText?: string;
    enAltText?: string;
    zhSeoTitle?: string;
    zhSeoDescription?: string;
    enSeoTitle?: string;
    enSeoDescription?: string;
    userId: string;
  }
) {
  const trimmedUrl = url.trim();
  const trimmedAltText = altText.trim();
  const nextZhAltText = zhAltText?.trim() || trimmedAltText;
  const nextEnAltText = enAltText?.trim() ?? "";
  const now = new Date();
  const [asset] = await client
    .insert(mediaAssets)
    .values({
      url: trimmedUrl,
      altText: trimmedAltText || nextZhAltText || nextEnAltText,
      caption: caption?.trim() ?? "",
      zhAltText: nextZhAltText,
      enAltText: nextEnAltText,
      zhSeoTitle: zhSeoTitle?.trim() ?? "",
      zhSeoDescription: zhSeoDescription?.trim() ?? "",
      enSeoTitle: enSeoTitle?.trim() ?? "",
      enSeoDescription: enSeoDescription?.trim() ?? "",
      storageProvider: "external_url",
      createdBy: userId,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: mediaAssets.url,
      set: {
        altText: trimmedAltText || nextZhAltText || nextEnAltText,
        caption: caption?.trim() ?? "",
        zhAltText: nextZhAltText,
        enAltText: nextEnAltText,
        zhSeoTitle: zhSeoTitle?.trim() ?? "",
        zhSeoDescription: zhSeoDescription?.trim() ?? "",
        enSeoTitle: enSeoTitle?.trim() ?? "",
        enSeoDescription: enSeoDescription?.trim() ?? "",
        deletedAt: null,
        updatedAt: now
      }
    })
    .returning({ id: mediaAssets.id });

  return asset.id;
}
