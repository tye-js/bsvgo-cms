import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";
import {
  getMediaAssetWithClient,
  upsertMediaAssetFromUrlWithClient
} from "@/server/media/service";
import { toNullable, toRequiredText } from "@/server/content/normalizers";

type ContentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolveCoverImage(
  tx: ContentTransaction,
  {
    coverImageId,
    coverImageUrl,
    coverImageAlt,
    fallbackText,
    userId
  }: {
    coverImageId?: string;
    coverImageUrl?: string;
    coverImageAlt?: string;
    fallbackText: string;
    userId: string;
  }
) {
  const requestedId = toNullable(coverImageId);
  const requestedUrl = toRequiredText(coverImageUrl);
  const altText = toRequiredText(coverImageAlt) || fallbackText;

  if (requestedId) {
    const asset = await getMediaAssetWithClient(tx, requestedId);
    if (asset) {
      if (!toRequiredText(asset.altText) && altText) {
        await tx
          .update(mediaAssets)
          .set({
            altText,
            zhAltText: toRequiredText(asset.zhAltText) || altText,
            updatedAt: new Date()
          })
          .where(eq(mediaAssets.id, asset.id));
      }

      return {
        coverImage: asset.url,
        coverImageId: asset.id
      };
    }
  }

  if (!requestedUrl) {
    return {
      coverImage: "",
      coverImageId: null
    };
  }

  const mediaAssetId = await upsertMediaAssetFromUrlWithClient(tx, {
    url: requestedUrl,
    altText,
    caption: fallbackText,
    userId
  });

  return {
    coverImage: requestedUrl,
    coverImageId: mediaAssetId
  };
}
