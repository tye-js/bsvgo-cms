import type { PostMark } from "@/server/db/schema";

export type PostMarkFilter = "all" | "empty" | PostMark;

export const postMarkOptions = [
  { value: "", label: "空" },
  { value: "featured", label: "精选" },
  { value: "pinned", label: "置顶" },
  { value: "sponsored", label: "推广" }
] as const;

export const postMarkFilterOptions = [
  { value: "all", label: "全部标记" },
  { value: "empty", label: "空" },
  { value: "featured", label: "精选" },
  { value: "pinned", label: "置顶" },
  { value: "sponsored", label: "推广" }
] as const satisfies ReadonlyArray<{
  value: PostMarkFilter;
  label: string;
}>;

export function postMarkLabel(mark: string | null | undefined) {
  switch (mark) {
    case "featured":
      return "精选";
    case "pinned":
      return "置顶";
    case "sponsored":
      return "推广";
    default:
      return "空";
  }
}

export function isPostMark(value: string): value is PostMark {
  return value === "" || value === "featured" || value === "pinned" || value === "sponsored";
}

export function normalizePostMark(value: string | null | undefined): PostMark {
  const trimmed = value?.trim() ?? "";
  return isPostMark(trimmed) ? trimmed : "";
}

export function postMarkFromFilter(value: PostMarkFilter): PostMark {
  return value === "all" || value === "empty" ? "" : value;
}

export function postMarkFlags(mark: PostMark) {
  return {
    featured: mark === "featured",
    pinned: mark === "pinned"
  };
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
