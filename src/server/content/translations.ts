import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { postTranslations, type Locale } from "@/server/db/schema";
import { toRequiredText } from "@/server/content/normalizers";

type ContentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function structuredDataValue(value?: string | Record<string, unknown> | null) {
  if (!value) return {};
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function upsertPostTranslation(
  tx: ContentTransaction,
  postId: string,
  locale: Locale,
  values: {
    title?: string;
    excerpt?: string;
    content?: string;
    readingMinutes?: number;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
    ogImage?: string;
    structuredData?: string | Record<string, unknown> | null;
  }
) {
  const title = values.title?.trim();
  const excerpt = toRequiredText(values.excerpt);
  const content = toRequiredText(values.content);
  const seoTitle = toRequiredText(values.seoTitle);
  const seoDescription = toRequiredText(values.seoDescription);
  const canonicalUrl = toRequiredText(values.canonicalUrl);
  const ogImage = toRequiredText(values.ogImage);
  const structuredData = structuredDataValue(values.structuredData);

  if (!title && locale === "zh" && !excerpt && !content) {
    await tx
      .delete(postTranslations)
      .where(
        and(
          eq(postTranslations.postId, postId),
          eq(postTranslations.locale, locale)
        )
      );
    return;
  }

  await tx
    .insert(postTranslations)
    .values({
      postId,
      locale,
      title: title || "",
      excerpt,
      content,
      readingMinutes: values.readingMinutes ?? 1,
      seoTitle,
      seoDescription,
      canonicalUrl,
      ogImage,
      structuredData
    })
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.locale],
      set: {
        title: title || "",
        excerpt,
        content,
        readingMinutes: values.readingMinutes ?? 1,
        seoTitle,
        seoDescription,
        canonicalUrl,
        ogImage,
        structuredData,
        updatedAt: new Date()
      }
    });
}
