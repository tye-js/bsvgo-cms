import type { PostMark } from "@/server/db/schema";

export function isPostMark(value: string): value is PostMark {
  return value === "" || value === "featured" || value === "pinned" || value === "sponsored";
}

export function normalizePostMark(value: string | null | undefined): PostMark {
  const trimmed = value?.trim() ?? "";
  return isPostMark(trimmed) ? trimmed : "";
}

export function derivePostMark(input: {
  mark?: string | null;
  featured?: boolean | null;
  pinned?: boolean | null;
}) {
  const normalizedMark = normalizePostMark(input.mark);
  if (normalizedMark) return normalizedMark;
  if (input.pinned) return "pinned";
  if (input.featured) return "featured";
  return "";
}
