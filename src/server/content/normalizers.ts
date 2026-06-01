export function toNullable(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toRequiredText(value: string | undefined) {
  return value?.trim() ?? "";
}

function dateFromLocalInput(value: string, timezoneOffset: string | undefined) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const offsetMinutes = Number(timezoneOffset);
  if (!Number.isFinite(offsetMinutes)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, year, month, day, hour, minute, second] = match;
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0")
  );

  // Date#getTimezoneOffset returns UTC - local in minutes.
  return new Date(utcTime + offsetMinutes * 60_000);
}

export function publishedAtValue(
  value: string | undefined,
  status: string,
  timezoneOffset?: string
) {
  if (value) return dateFromLocalInput(value, timezoneOffset);
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

export function readingMinutesForContent(content: string | undefined, locale: "en" | "zh") {
  const text = content
    ?.replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_\-~]/g, " ")
    .trim();

  if (!text) return 1;

  const count =
    locale === "zh"
      ? (text.match(/[\p{Script=Han}]/gu)?.length ?? 0) +
        (text.match(/[A-Za-z0-9]+/g)?.length ?? 0)
      : text.split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = locale === "zh" ? 500 : 220;

  return Math.min(Math.max(Math.ceil(count / wordsPerMinute), 1), 240);
}
