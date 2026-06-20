"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  bulkPostSeoSchema,
  categorySchema,
  newPostSchema,
  postPlacementSchema,
  postSchema,
  tagSchema,
  topicCollectionPostSchema,
  topicCollectionSortSchema,
  userSchema
} from "@/lib/validators";
import { createAiJob } from "@/server/ai/jobs";
import { redirectWithToast } from "@/server/admin/toast";
import { generateEnglishPost } from "@/server/ai/openai";
import { requireContentEditor, requireRole } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  postPlacements,
  postTags,
  posts,
  tagTranslations,
  tags,
  topicCollectionPosts,
  topicCollections,
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
  jobId?: string;
};

const POST_WRITE_TIMEOUT = sql`set local statement_timeout = '15s'`;

class UserFacingActionError extends Error {}

function friendlyActionError(error: unknown) {
  if (error instanceof UserFacingActionError) return error.message;
  return friendlyDatabaseError(error);
}

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
  const user = await requireContentEditor();
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
  redirectWithToast({
    path: `/posts/${createdId}/edit`,
    message: "文章已创建。"
  });
}

export async function updatePostAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
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
  await requireContentEditor();

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
        throw new UserFacingActionError("文章不存在或已删除。");
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
    return { error: friendlyActionError(error) };
  }

  revalidatePath("/placements");
  revalidatePath("/posts");
  revalidatePath(`/posts/${data.postId}/edit`);
  return { success: "展示位已保存。" };
}

export async function addTopicCollectionPostAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
  const parsed = topicCollectionPostSchema.safeParse({
    collectionId: stringValue(formData, "collectionId"),
    postId: stringValue(formData, "postId"),
    sortOrder: stringValue(formData, "sortOrder")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "专题文章数据无效" };
  }

  const data = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [collection] = await tx
        .select({ id: topicCollections.id })
        .from(topicCollections)
        .where(
          and(
            eq(topicCollections.id, data.collectionId),
            isNull(topicCollections.deletedAt)
          )
        )
        .limit(1);

      if (!collection) throw new UserFacingActionError("专题不存在或已删除。");

      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, data.postId), isNull(posts.deletedAt)))
        .limit(1);

      if (!post) throw new UserFacingActionError("文章不存在或已删除。");

      const [maxSortRow] = await tx
        .select({
          maxSortOrder: sql<number>`coalesce(max(${topicCollectionPosts.sortOrder}), 0)`
        })
        .from(topicCollectionPosts)
        .where(eq(topicCollectionPosts.collectionId, data.collectionId));
      const sortOrder = data.sortOrder ?? Number(maxSortRow?.maxSortOrder ?? 0) + 1000;

      await tx
        .insert(topicCollectionPosts)
        .values({
          collectionId: data.collectionId,
          postId: data.postId,
          sortOrder
        })
        .onConflictDoUpdate({
          target: [
            topicCollectionPosts.collectionId,
            topicCollectionPosts.postId
          ],
          set: {
            sortOrder
          }
        });

      await tx
        .update(topicCollections)
        .set({ updatedAt: new Date() })
        .where(eq(topicCollections.id, data.collectionId));
    });
  } catch (error) {
    return { error: friendlyActionError(error) };
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${data.collectionId}`);
  return { success: "文章已加入专题。" };
}

export async function updateTopicCollectionSortAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
  const postIds = formData.getAll("postId").map(String);
  const sortOrders = formData.getAll("sortOrder").map(String);
  const parsed = topicCollectionSortSchema.safeParse({
    collectionId: stringValue(formData, "collectionId"),
    items: postIds.map((postId, index) => ({
      postId,
      sortOrder: sortOrders[index] ?? "0"
    }))
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "专题排序数据无效" };
  }

  const data = parsed.data;

  try {
    await db.transaction(async (tx) => {
      for (const item of data.items) {
        await tx
          .update(topicCollectionPosts)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(topicCollectionPosts.collectionId, data.collectionId),
              eq(topicCollectionPosts.postId, item.postId)
            )
          );
      }

      await tx
        .update(topicCollections)
        .set({ updatedAt: new Date() })
        .where(eq(topicCollections.id, data.collectionId));
    });
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${data.collectionId}`);
  return { success: "专题文章排序已保存。" };
}

export async function removeTopicCollectionPostAction(formData: FormData) {
  await requireContentEditor();
  const parsed = topicCollectionPostSchema.safeParse({
    collectionId: stringValue(formData, "collectionId"),
    postId: stringValue(formData, "postId")
  });

  if (!parsed.success) {
    redirectWithToast({
      path: "/collections",
      type: "error",
      message: parsed.error.issues[0]?.message ?? "专题文章数据无效。"
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(topicCollectionPosts)
        .where(
          and(
            eq(topicCollectionPosts.collectionId, parsed.data.collectionId),
            eq(topicCollectionPosts.postId, parsed.data.postId)
          )
        );
      await tx
        .update(topicCollections)
        .set({ updatedAt: new Date() })
        .where(eq(topicCollections.id, parsed.data.collectionId));
    });
  } catch (error) {
    redirectWithToast({
      path: `/collections/${parsed.data.collectionId}`,
      type: "error",
      message: friendlyDatabaseError(error)
    });
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${parsed.data.collectionId}`);
  redirectWithToast({
    path: `/collections/${parsed.data.collectionId}`,
    message: "文章已从专题中移除。"
  });
}

export async function deletePostAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  if (!id) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: "缺少文章 ID，无法删除。"
    });
  }

  try {
    await db.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
        .limit(1);

      if (!post) throw new UserFacingActionError("文章不存在或已删除。");

      await tx.delete(postPlacements).where(eq(postPlacements.postId, id));
      await tx
        .update(posts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(posts.id, id));
    });
  } catch (error) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: friendlyActionError(error)
    });
  }

  revalidatePath("/posts");
  revalidatePath("/placements");
  revalidatePath("/seo");
  revalidatePath("/collections");
  redirectWithToast({
    path: "/posts",
    message: "文章已删除。"
  });
}

export async function setPostStatusAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  const status = stringValue(formData, "status");

  if (!id) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: "缺少文章 ID，无法更新状态。"
    });
  }

  if (!["draft", "published", "archived"].includes(status)) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: "文章状态无效。"
    });
  }

  let updatedPostId: string | null = null;
  try {
    const [post] = await db
      .update(posts)
      .set({
        status: status as "draft" | "published" | "archived",
        publishedAt: status === "published" ? new Date() : null,
        updatedAt: new Date()
      })
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .returning({ id: posts.id });
    updatedPostId = post?.id ?? null;
  } catch (error) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: friendlyDatabaseError(error)
    });
  }

  if (!updatedPostId) {
    redirectWithToast({
      path: "/posts",
      type: "error",
      message: "文章不存在或已删除。"
    });
  }

  revalidatePath("/posts");
  revalidatePath("/placements");
  revalidatePath("/seo");
  redirectWithToast({
    path: "/posts",
    message: status === "published" ? "文章已发布。" : "文章已下架为草稿。"
  });
}

export async function bulkGeneratePostSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
  const parsed = bulkPostSeoSchema.safeParse({
    postIds: formData.getAll("postIds").map(String).filter(Boolean)
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "请选择需要生成 SEO 的文章" };
  }

  const postIds = parsed.data.postIds;
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.id, postIds), isNull(posts.deletedAt)));

  if (!rows.length) {
    return { error: "没有找到可处理的文章。" };
  }

  const job = await createAiJob({
    type: "bulk_post_seo",
    input: { postIds: rows.map((row) => row.id) },
    userId: user.id
  });

  return {
    success: `已提交 ${rows.length} 篇文章的 SEO 生成任务。`,
    jobId: job.id
  };
}

export async function updateCategoryAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
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

  try {
    await db.transaction(async (tx) => {
      const [category] = await tx
        .update(categories)
        .set({
          seoTitle: toNullable(data.enSeoTitle),
          seoDescription: toNullable(data.enSeoDescription),
          updatedAt: new Date()
        })
        .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
        .returning({ id: categories.id });

      if (!category) {
        throw new UserFacingActionError("分类不存在或已删除。");
      }

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
  } catch (error) {
    return { error: friendlyActionError(error) };
  }

  revalidatePath("/categories");
  revalidatePath(`/categories/${id}/edit`);
  return { success: "分类已保存。" };
}

export async function createTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
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
  let createdId: string;

  try {
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

      await tx
        .insert(tagTranslations)
        .values({
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
    createdId = created.id;
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/tags");
  redirectWithToast({
    path: `/tags/${createdId}/edit`,
    message: "标签已创建。"
  });
}

export async function updateTagAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireContentEditor();
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

  try {
    await db.transaction(async (tx) => {
      const [tag] = await tx
        .update(tags)
        .set({
          slug: data.slug,
          name: data.enName,
          seoTitle: toNullable(data.enSeoTitle),
          seoDescription: toNullable(data.enSeoDescription),
          updatedAt: new Date()
        })
        .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
        .returning({ id: tags.id });

      if (!tag) {
        throw new UserFacingActionError("标签不存在或已删除。");
      }

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
  } catch (error) {
    return { error: friendlyActionError(error) };
  }

  revalidatePath("/tags");
  revalidatePath(`/tags/${id}/edit`);
  return { success: "标签已保存。" };
}

export async function deleteTagAction(formData: FormData) {
  await requireContentEditor();
  const id = stringValue(formData, "id");
  if (!id) {
    redirectWithToast({
      path: "/tags",
      type: "error",
      message: "缺少标签 ID，无法删除。"
    });
  }

  try {
    await db.transaction(async (tx) => {
      const [tag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
        .limit(1);

      if (!tag) throw new UserFacingActionError("标签不存在或已删除。");

      await tx.delete(postTags).where(eq(postTags.tagId, id));
      await tx
        .update(tags)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(tags.id, id));
    });
  } catch (error) {
    redirectWithToast({
      path: "/tags",
      type: "error",
      message: friendlyActionError(error)
    });
  }

  revalidatePath("/tags");
  redirectWithToast({
    path: "/tags",
    message: "标签已删除。"
  });
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

  try {
    await db.insert(users).values({
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      role: parsed.data.role,
      isAdmin: parsed.data.role === "admin",
      password: await hashPassword(parsed.data.password)
    });
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/users");
  redirectWithToast({
    path: "/users",
    message: "用户已创建。"
  });
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireRole(["admin"]);
  const id = stringValue(formData, "id");
  if (!id) {
    redirectWithToast({
      path: "/users",
      type: "error",
      message: "缺少用户 ID，无法移除。"
    });
  }
  if (id === currentUser.id) {
    redirectWithToast({
      path: "/users",
      type: "error",
      message: "不能移除当前登录用户。"
    });
  }

  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(users.id, id),
        inArray(users.role, ["admin", "editor"]),
        isNull(users.deletedAt)
      )
    )
    .returning({ id: users.id });

  if (!user) {
    redirectWithToast({
      path: "/users",
      type: "error",
      message: "用户不存在或已被移除。"
    });
  }

  revalidatePath("/users");
  redirectWithToast({
    path: "/users",
    message: "用户已移除。"
  });
}
