import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listMediaAssets() {
  return db
    .select()
    .from(mediaAssets)
    .where(isNull(mediaAssets.deletedAt))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(80);
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
