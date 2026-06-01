"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  bulkPostSeoSchema,
  categorySchema,
  newPostSchema,
  postPlacementSchema,
  postSchema,
  tagSchema,
  userSchema
} from "@/lib/validators";
import { generateEnglishPost, generateSeoSuggestion } from "@/server/ai/openai";
import { requireRole, requireUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  postPlacements,
  postTags,
  postTranslations,
  posts,
  tagTranslations,
  tags,
  users
} from "@/server/db/schema";
import { aiAuthorValues } from "@/server/content/ai-author";
import { resolveCoverImage } from "@/server/content/cover-image";
import { friendlyAiError, friendlyDatabaseError } from "@/server/content/errors";
import {
  placementsFromForm,
  postDataFromForm,
  stringValue
} from "@/server/content/form-data";
import {
  fallbackSlug,
  publishedAtValue,
  readingMinutesForContent,
  toNullable,
  toRequiredText
} from "@/server/content/normalizers";
import {
  deriveLegacyPostFlags,
  emptyPostPlacements,
  replacePostPlacements
} from "@/server/content/placements";
import { upsertPostTranslation } from "@/server/content/translations";

type ActionState = {
  error?: string;
  success?: string;
};

const POST_WRITE_TIMEOUT = sql`set local statement_timeout = '15s'`;

function structuredDataString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? JSON.stringify(parsed)
      : "";
  } catch {
    return "";
  }
}

export async function createPostAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = newPostSchema.safeParse(postDataFromForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "文章数据无效" };
  }

  const zhData = {
    ...parsed.data,
    slug:
      parsed.data.slug.trim() ||
      fallbackSlug(parsed.data.zhTitle || parsed.data.enTitle || "draft-post")
  };
  const legacyFlags = deriveLegacyPostFlags(emptyPostPlacements(), zhData.mark);
  const english =
    zhData.enTitle?.trim() && zhData.enContent?.trim()
      ? {
          title: zhData.enTitle,
          excerpt: zhData.enExcerpt ?? "",
          content: zhData.enContent,
          seoTitle: zhData.enSeoTitle ?? "",
          seoDescription: zhData.enSeoDescription ?? ""
        }
      : await generateEnglishPost({
          writingRole: zhData.writingRole,
          title: zhData.zhTitle,
          excerpt: zhData.zhExcerpt,
          content: zhData.zhContent
        }).catch((error) => ({ error: friendlyAiError(error) }));

  if ("error" in english) return english;

  const data = {
    ...zhData,
    enTitle: english.title,
    enExcerpt: english.excerpt,
    enContent: english.content,
    enSeoTitle: zhData.enSeoTitle || english.seoTitle,
    enSeoDescription: zhData.enSeoDescription || english.seoDescription,
    zhSeoTitle: zhData.zhSeoTitle || zhData.zhTitle,
    zhSeoDescription: zhData.zhSeoDescription || zhData.zhExcerpt
  };

  let createdId: string;

  try {
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const coverImageText = data.enTitle || data.zhTitle || data.slug;
      const coverImage = await resolveCoverImage(tx, {
        coverImageId: data.coverImageId,
        coverImageUrl: data.coverImageUrl,
        coverImageAlt: data.coverImageAlt,
        fallbackText: coverImageText,
        userId: user.id
      });

      const [post] = await tx
        .insert(posts)
        .values({
          slug: data.slug,
          categoryId: data.categoryId,
          authorId: user.id,
          status: data.status,
          mark: legacyFlags.mark,
          ...aiAuthorValues(data.writingRole),
          coverImage: coverImage.coverImage,
          coverImageId: coverImage.coverImageId,
          publishedAt: publishedAtValue(
            data.publishedAt,
            data.status,
            data.publishedAtTimezoneOffset
          ),
          featured: legacyFlags.featured,
          pinned: legacyFlags.pinned,
          sortOrder: data.sortOrder
        })
        .returning({ id: posts.id });

      await upsertPostTranslation(tx, post.id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: readingMinutesForContent(data.enContent, "en"),
        seoTitle: data.enSeoTitle,
        seoDescription: data.enSeoDescription,
        canonicalUrl: data.enCanonicalUrl,
        ogImage: data.enOgImage,
        structuredData: structuredDataString(data.enStructuredData)
      });
      await upsertPostTranslation(tx, post.id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: readingMinutesForContent(data.zhContent, "zh"),
        seoTitle: data.zhSeoTitle,
        seoDescription: data.zhSeoDescription,
        canonicalUrl: data.zhCanonicalUrl,
        ogImage: data.zhOgImage,
        structuredData: structuredDataString(data.zhStructuredData)
      });

      if (data.tagIds.length) {
        await tx
          .insert(postTags)
          .values(data.tagIds.map((tagId) => ({ postId: post.id, tagId })));
      }

      return [post];
    });
    createdId = created.id;
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/posts");
  redirect(`/posts/${createdId}/edit`);
}

export async function updatePostAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = postSchema.safeParse(postDataFromForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "文章数据无效" };
  }

  const data = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const coverImageText = data.enTitle || data.zhTitle || data.slug;
      const coverImage = await resolveCoverImage(tx, {
        coverImageId: data.coverImageId,
        coverImageUrl: data.coverImageUrl,
        coverImageAlt: data.coverImageAlt,
        fallbackText: coverImageText,
        userId: user.id
      });

      await tx
        .update(posts)
        .set({
          slug: data.slug,
          categoryId: data.categoryId,
          status: data.status,
          ...aiAuthorValues(data.writingRole),
          coverImage: coverImage.coverImage,
          coverImageId: coverImage.coverImageId,
          publishedAt: publishedAtValue(
            data.publishedAt,
            data.status,
            data.publishedAtTimezoneOffset
          ),
          sortOrder: data.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(posts.id, id));

      await upsertPostTranslation(tx, id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: readingMinutesForContent(data.enContent, "en"),
        seoTitle: data.enSeoTitle,
        seoDescription: data.enSeoDescription,
        canonicalUrl: data.enCanonicalUrl,
        ogImage: data.enOgImage,
        structuredData: structuredDataString(data.enStructuredData)
      });
      await upsertPostTranslation(tx, id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: readingMinutesForContent(data.zhContent, "zh"),
        seoTitle: data.zhSeoTitle,
        seoDescription: data.zhSeoDescription,
        canonicalUrl: data.zhCanonicalUrl,
        ogImage: data.zhOgImage,
        structuredData: structuredDataString(data.zhStructuredData)
      });

      await tx
        .update(postPlacements)
        .set({ categoryId: data.categoryId, updatedAt: new Date() })
        .where(and(eq(postPlacements.postId, id), eq(postPlacements.scope, "category")));

      await tx.delete(postTags).where(eq(postTags.postId, id));
      if (data.tagIds.length) {
        await tx
          .insert(postTags)
          .values(data.tagIds.map((tagId) => ({ postId: id, tagId })));
      }
    });
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/posts");
  revalidatePath("/placements");
  revalidatePath(`/posts/${id}/edit`);
  revalidatePath("/seo");
  return { success: "文章已保存。" };
}

export async function updatePostPlacementsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const parsed = postPlacementSchema.safeParse({
    postId: stringValue(formData, "postId"),
    placements: placementsFromForm(formData)
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "展示位数据无效" };
  }

  const data = parsed.data;
  const legacyFlags = deriveLegacyPostFlags(data.placements, "");

  try {
    await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const [post] = await tx
        .select({ categoryId: posts.categoryId })
        .from(posts)
        .where(and(eq(posts.id, data.postId), isNull(posts.deletedAt)))
        .limit(1);

      if (!post) {
        throw new Error("Post not found");
      }

      await replacePostPlacements(tx, data.postId, post.categoryId, data.placements);
      await tx
        .update(posts)
        .set({
          mark: legacyFlags.mark,
          featured: legacyFlags.featured,
          pinned: legacyFlags.pinned,
          updatedAt: new Date()
        })
        .where(and(eq(posts.id, data.postId), isNull(posts.deletedAt)));
    });
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/placements");
  revalidatePath("/posts");
  revalidatePath(`/posts/${data.postId}/edit`);
  return { success: "展示位已保存。" };
}

export async function deletePostAction(formData: FormData) {
  await requireUser();
  const id = stringValue(formData, "id");
  await db.transaction(async (tx) => {
    await tx.delete(postPlacements).where(eq(postPlacements.postId, id));
    await tx
      .update(posts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, id));
  });
  revalidatePath("/posts");
  revalidatePath("/placements");
  revalidatePath("/seo");
}

export async function setPostStatusAction(formData: FormData) {
  await requireUser();
  const id = stringValue(formData, "id");
  const status = stringValue(formData, "status");

  if (!["draft", "published", "archived"].includes(status)) return;

  await db
    .update(posts)
    .set({
      status: status as "draft" | "published" | "archived",
      publishedAt: status === "published" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(posts.id, id));

  revalidatePath("/posts");
  revalidatePath("/placements");
  revalidatePath("/seo");
}

export async function bulkGeneratePostSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const parsed = bulkPostSeoSchema.safeParse({
    postIds: formData.getAll("postIds").map(String).filter(Boolean)
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "请选择需要生成 SEO 的文章" };
  }

  const postIds = parsed.data.postIds;
  const rows = await db
    .select({
      postId: posts.id,
      slug: posts.slug,
      locale: postTranslations.locale,
      title: postTranslations.title,
      excerpt: postTranslations.excerpt,
      content: postTranslations.content,
      coverImage: posts.coverImage,
      canonicalUrl: postTranslations.canonicalUrl,
      ogImage: postTranslations.ogImage,
      structuredData: postTranslations.structuredData
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(inArray(posts.id, postIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    return { error: "没有找到可处理的文章。" };
  }

  let updated = 0;

  for (const postId of postIds) {
    const translations = rows.filter((row) => row.postId === postId);
    const en = translations.find((row) => row.locale === "en");
    const zh = translations.find((row) => row.locale === "zh");
    if (!en && !zh) continue;

    try {
      const suggestion = await generateSeoSuggestion({
        targetType: "post",
        enTitle: en?.title ?? "",
        enDescription: en?.excerpt ?? "",
        enContent: en?.content ?? "",
        zhTitle: zh?.title ?? "",
        zhDescription: zh?.excerpt ?? "",
        zhContent: zh?.content ?? ""
      });

      await db.transaction(async (tx) => {
        if (en) {
          await tx
            .update(postTranslations)
            .set({
              seoTitle: suggestion.en.title,
              seoDescription: suggestion.en.description,
              ogImage: en.ogImage || en.coverImage || "",
              structuredData:
                en.structuredData && Object.keys(en.structuredData).length
                  ? en.structuredData
                  : suggestion.en.structuredData,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(postTranslations.postId, postId),
                eq(postTranslations.locale, "en")
              )
            );
        }

        if (zh) {
          await tx
            .update(postTranslations)
            .set({
              seoTitle: suggestion.zh.title,
              seoDescription: suggestion.zh.description,
              ogImage: zh.ogImage || zh.coverImage || "",
              structuredData:
                zh.structuredData && Object.keys(zh.structuredData).length
                  ? zh.structuredData
                  : suggestion.zh.structuredData,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(postTranslations.postId, postId),
                eq(postTranslations.locale, "zh")
              )
            );
        }
      });

      updated += 1;
    } catch (error) {
      return {
        error: `已处理 ${updated} 篇，后续 AI 生成失败：${friendlyAiError(error)}`
      };
    }
  }

  revalidatePath("/seo");
  revalidatePath("/posts");
  return { success: `已为 ${updated} 篇文章生成 SEO，请检查后发布。` };
}

export async function updateCategoryAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const parsed = categorySchema.safeParse({
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "分类数据无效" };
  }

  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({
        seoTitle: toNullable(data.enSeoTitle),
        seoDescription: toNullable(data.enSeoDescription),
        updatedAt: new Date()
      })
      .where(eq(categories.id, id));

    for (const locale of ["en", "zh"] as const) {
      await tx
        .insert(categoryTranslations)
        .values({
          categoryId: id,
          locale,
          name: locale === "en" ? data.enName : data.zhName,
          description:
            locale === "en"
              ? toRequiredText(data.enDescription)
              : toRequiredText(data.zhDescription),
          seoTitle:
            locale === "en"
              ? toRequiredText(data.enSeoTitle)
              : toRequiredText(data.zhSeoTitle),
          seoDescription:
            locale === "en"
              ? toRequiredText(data.enSeoDescription)
              : toRequiredText(data.zhSeoDescription)
        })
        .onConflictDoUpdate({
          target: [categoryTranslations.categoryId, categoryTranslations.locale],
          set: {
            name: locale === "en" ? data.enName : data.zhName,
            description:
              locale === "en"
                ? toRequiredText(data.enDescription)
                : toRequiredText(data.zhDescription),
            seoTitle:
              locale === "en"
                ? toRequiredText(data.enSeoTitle)
                : toRequiredText(data.zhSeoTitle),
            seoDescription:
              locale === "en"
                ? toRequiredText(data.enSeoDescription)
                : toRequiredText(data.zhSeoDescription),
            updatedAt: new Date()
          }
        });
    }
  });

  revalidatePath("/categories");
  revalidatePath(`/categories/${id}/edit`);
  return { success: "分类已保存。" };
}

export async function createTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const parsed = tagSchema.safeParse({
    slug: stringValue(formData, "slug"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "标签数据无效" };
  }

  const data = parsed.data;

  const [created] = await db.transaction(async (tx) => {
    const [tag] = await tx
      .insert(tags)
      .values({
        name: data.enName,
        slug: data.slug,
        seoTitle: toNullable(data.enSeoTitle),
        seoDescription: toNullable(data.enSeoDescription)
      })
      .returning({ id: tags.id });

    await tx.insert(tagTranslations).values({
      tagId: tag.id,
      locale: "en",
      name: data.enName,
      description: toRequiredText(data.enDescription),
      seoTitle: toRequiredText(data.enSeoTitle),
      seoDescription: toRequiredText(data.enSeoDescription)
    });

    await tx.insert(tagTranslations).values({
      tagId: tag.id,
      locale: "zh",
      name: data.zhName,
      description: toRequiredText(data.zhDescription),
      seoTitle: toRequiredText(data.zhSeoTitle),
      seoDescription: toRequiredText(data.zhSeoDescription)
    });

    return [tag];
  });

  revalidatePath("/tags");
  redirect(`/tags/${created.id}/edit`);
}

export async function updateTagAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const parsed = tagSchema.safeParse({
    slug: stringValue(formData, "slug"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "标签数据无效" };
  }

  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(tags)
      .set({
        slug: data.slug,
        name: data.enName,
        seoTitle: toNullable(data.enSeoTitle),
        seoDescription: toNullable(data.enSeoDescription),
        updatedAt: new Date()
      })
      .where(eq(tags.id, id));

    await tx
      .insert(tagTranslations)
      .values({
        tagId: id,
        locale: "en",
        name: data.enName,
        description: toRequiredText(data.enDescription),
        seoTitle: toRequiredText(data.enSeoTitle),
        seoDescription: toRequiredText(data.enSeoDescription)
      })
      .onConflictDoUpdate({
        target: [tagTranslations.tagId, tagTranslations.locale],
        set: {
          name: data.enName,
          description: toRequiredText(data.enDescription),
          seoTitle: toRequiredText(data.enSeoTitle),
          seoDescription: toRequiredText(data.enSeoDescription)
        }
      });

    await tx
      .insert(tagTranslations)
      .values({
        tagId: id,
        locale: "zh",
        name: data.zhName,
        description: toRequiredText(data.zhDescription),
        seoTitle: toRequiredText(data.zhSeoTitle),
        seoDescription: toRequiredText(data.zhSeoDescription)
      })
      .onConflictDoUpdate({
        target: [tagTranslations.tagId, tagTranslations.locale],
        set: {
          name: data.zhName,
          description: toRequiredText(data.zhDescription),
          seoTitle: toRequiredText(data.zhSeoTitle),
          seoDescription: toRequiredText(data.zhSeoDescription)
        }
      });
  });

  revalidatePath("/tags");
  revalidatePath(`/tags/${id}/edit`);
  return { success: "标签已保存。" };
}

export async function deleteTagAction(formData: FormData) {
  await requireUser();
  const id = stringValue(formData, "id");
  await db.transaction(async (tx) => {
    await tx.delete(postTags).where(eq(postTags.tagId, id));
    await tx
      .update(tags)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tags.id, id));
  });
  revalidatePath("/tags");
}

export async function createUserAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = userSchema.safeParse({
    email: stringValue(formData, "email"),
    name: stringValue(formData, "name"),
    password: stringValue(formData, "password"),
    role: stringValue(formData, "role")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "用户数据无效" };
  }

  await db.insert(users).values({
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role,
    isAdmin: parsed.data.role === "admin",
    password: await hashPassword(parsed.data.password)
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireRole(["admin"]);
  const id = stringValue(formData, "id");
  if (id === currentUser.id) return;

  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, id), inArray(users.role, ["admin", "editor"])));
  revalidatePath("/users");
}
