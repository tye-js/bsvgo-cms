import "server-only";

import { eq } from "drizzle-orm";

import { derivePostMark } from "@/lib/post-mark";
import { db } from "@/server/db";
import { postPlacements, type PostMark } from "@/server/db/schema";

type PlacementFormValue = {
  enabled?: boolean;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
};

export type PostPlacementFormValues = {
  homeFeatured: PlacementFormValue;
  homePromoted: PlacementFormValue;
  categoryFeatured: PlacementFormValue;
  categoryPromoted: PlacementFormValue;
};

type ContentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function optionalDateValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed) : null;
}

export function emptyPostPlacements(): PostPlacementFormValues {
  return {
    homeFeatured: {
      enabled: false,
      sortOrder: 0,
      startsAt: "",
      endsAt: ""
    },
    homePromoted: {
      enabled: false,
      sortOrder: 0,
      startsAt: "",
      endsAt: ""
    },
    categoryFeatured: {
      enabled: false,
      sortOrder: 0,
      startsAt: "",
      endsAt: ""
    },
    categoryPromoted: {
      enabled: false,
      sortOrder: 0,
      startsAt: "",
      endsAt: ""
    }
  };
}

export function deriveLegacyPostFlags(
  placements: PostPlacementFormValues,
  fallbackMark: string | null | undefined
): {
  mark: PostMark;
  featured: boolean;
  pinned: boolean;
} {
  const featured = Boolean(placements.categoryFeatured.enabled);
  const pinned = Boolean(placements.homeFeatured.enabled);
  const promoted =
    Boolean(placements.homePromoted.enabled) ||
    Boolean(placements.categoryPromoted.enabled);

  return {
    mark: promoted
      ? "sponsored"
      : derivePostMark({
          mark: fallbackMark,
          featured,
          pinned
        }),
    featured,
    pinned
  };
}

export async function replacePostPlacements(
  tx: ContentTransaction,
  postId: string,
  categoryId: string,
  placements: PostPlacementFormValues
) {
  const placementRows = [
    {
      values: placements.homeFeatured,
      scope: "home" as const,
      slot: "featured" as const,
      categoryId: null
    },
    {
      values: placements.homePromoted,
      scope: "home" as const,
      slot: "promoted" as const,
      categoryId: null
    },
    {
      values: placements.categoryFeatured,
      scope: "category" as const,
      slot: "featured" as const,
      categoryId
    },
    {
      values: placements.categoryPromoted,
      scope: "category" as const,
      slot: "promoted" as const,
      categoryId
    }
  ]
    .filter((placement) => placement.values.enabled)
    .map((placement) => ({
      postId,
      categoryId: placement.categoryId,
      scope: placement.scope,
      slot: placement.slot,
      sortOrder: placement.values.sortOrder,
      enabled: true,
      startsAt: optionalDateValue(placement.values.startsAt),
      endsAt: optionalDateValue(placement.values.endsAt),
      updatedAt: new Date()
    }));

  await tx.delete(postPlacements).where(eq(postPlacements.postId, postId));

  if (placementRows.length) {
    await tx.insert(postPlacements).values(placementRows);
  }
}
