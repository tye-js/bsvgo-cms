export const POST_COVER_PLACEHOLDER_URL = "/images/post-cover-placeholder.svg";

export function coverImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || POST_COVER_PLACEHOLDER_URL;
}
