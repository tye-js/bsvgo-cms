import "server-only";

import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listMediaAssets(options: {
  query?: string;
  provider?: "all" | "local" | "external_url";
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Number.isFinite(options.page) ? Math.max(options.page ?? 1, 1) : 1;
  const pageSize = Number.isFinite(options.pageSize)
    ? Math.min(Math.max(options.pageSize ?? 24, 1), 100)
    : 24;
  const query = options.query?.trim();
  const provider = options.provider ?? "all";
  const filters = [
    isNull(mediaAssets.deletedAt),
    provider === "all" ? undefined : eq(mediaAssets.storageProvider, provider),
    query
      ? or(
          ilike(mediaAssets.url, `%${query}%`),
          ilike(mediaAssets.altText, `%${query}%`),
          ilike(mediaAssets.caption, `%${query}%`),
          ilike(mediaAssets.originalFilename, `%${query}%`)
        )
      : undefined
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
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
      storageProvider: mediaAssets.storageProvider,
      width: mediaAssets.width,
      height: mediaAssets.height,
      fileSize: mediaAssets.fileSize,
      createdAt: mediaAssets.createdAt
    })
    .from(mediaAssets)
    .where(isNull(mediaAssets.deletedAt))
    .orderBy(desc(mediaAssets.createdAt))
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

export async function getMediaAssetWithClient(
  client: typeof db | Transaction,
  id: string
) {
  const [asset] = await client
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText,
      caption: mediaAssets.caption
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
  userId
}: {
  url: string;
  altText: string;
  caption?: string;
  userId: string;
}) {
  return upsertMediaAssetFromUrlWithClient(db, {
    url,
    altText,
    caption,
    userId
  });
}

export async function upsertMediaAssetFromUrlWithClient(
  client: typeof db | Transaction,
  {
    url,
    altText,
    caption,
    userId
  }: {
    url: string;
    altText: string;
    caption?: string;
    userId: string;
  }
) {
  const trimmedUrl = url.trim();
  const now = new Date();
  const [asset] = await client
    .insert(mediaAssets)
    .values({
      url: trimmedUrl,
      altText: altText.trim(),
      caption: caption?.trim() ?? "",
      storageProvider: "external_url",
      createdBy: userId,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: mediaAssets.url,
      set: {
        altText: altText.trim(),
        caption: caption?.trim() ?? "",
        deletedAt: null,
        updatedAt: now
      }
    })
    .returning({ id: mediaAssets.id });

  return asset.id;
}
