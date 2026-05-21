export function toNullable(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toRequiredText(value: string | undefined) {
  return value?.trim() ?? "";
}

export function publishedAtValue(value: string | undefined, status: string) {
  if (value) return new Date(value);
  if (status === "published") return new Date();
  return null;
}

export function fallbackSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `draft-post-${Date.now()}`;
}
