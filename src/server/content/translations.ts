import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { postTranslations, type Locale } from "@/server/db/schema";
import { toRequiredText } from "@/server/content/normalizers";

type ContentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  }
) {
  const title = values.title?.trim();
  const excerpt = toRequiredText(values.excerpt);
  const content = toRequiredText(values.content);
  const seoTitle = toRequiredText(values.seoTitle);
  const seoDescription = toRequiredText(values.seoDescription);

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
      seoDescription
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
        updatedAt: new Date()
      }
    });
}
