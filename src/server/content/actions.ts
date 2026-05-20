"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  categorySchema,
  newPostSchema,
  postSchema,
  tagSchema,
  userSchema
} from "@/lib/validators";
import { generateEnglishPost } from "@/server/ai/openai";
import { requireRole, requireUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  mediaAssets,
  postTags,
  postTranslations,
  posts,
  tagTranslations,
  tags,
  users,
  type Locale
} from "@/server/db/schema";
import {
  derivePostMark,
  isPostMark,
  postMarkFlags
} from "@/lib/post-mark";
import {
  getMediaAssetWithClient,
  upsertMediaAssetFromUrlWithClient
} from "@/server/media/service";

type ActionState = {
  error?: string;
  success?: string;
};

const POST_WRITE_TIMEOUT = sql`set local statement_timeout = '15s'`;

function friendlyDatabaseError(error: unknown) {
  const messages: string[] = [];
  const codes: string[] = [];
  const constraints: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const dbError = current as {
      cause?: unknown;
      code?: string;
      constraint?: string;
      constraint_name?: string;
      message?: string;
    };

    messages.push(
      current instanceof Error ? current.message : String(dbError.message ?? current)
    );

    if (dbError.code) codes.push(dbError.code);
    if (dbError.constraint) constraints.push(dbError.constraint);
    if (dbError.constraint_name) constraints.push(dbError.constraint_name);

    current = dbError.cause;
  }

  const message = messages.join("\n");

  if (
    codes.includes("23505") ||
    message.includes("duplicate key value") ||
    constraints.some((constraint) => constraint.includes("slug"))
  ) {
    return "已存在相同 slug 的记录。请使用唯一 slug 后重试。";
  }

  if (
    codes.includes("57014") ||
    message.includes("statement timeout") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("timeout exceeded") ||
    message.includes("Connection terminated")
  ) {
    return "保存超时。请检查数据库连接后重试。";
  }

  return "保存失败，请重试。";
}

function friendlyAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("AI API key is not configured") ||
    message.includes("app_settings")
  ) {
    return "AI 尚未配置。请先到设置页保存 AI API Key，再创建文章。";
  }

  if (message.includes("timed out")) {
    return "英文生成超时，请重试。";
  }

  return "英文生成失败。请检查 AI 配置后重试。";
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function fallbackSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `draft-post-${Date.now()}`;
}

function postDataFromForm(formData: FormData) {
  const mark = stringValue(formData, "mark");
  return {
    slug: stringValue(formData, "slug"),
    categoryId: stringValue(formData, "categoryId"),
    status: stringValue(formData, "status"),
    mark,
    coverImageId: stringValue(formData, "coverImageId"),
    coverImageUrl: stringValue(formData, "coverImageUrl"),
    coverImageAlt: stringValue(formData, "coverImageAlt"),
    enSeoTitle: stringValue(formData, "enSeoTitle"),
    enSeoDescription: stringValue(formData, "enSeoDescription"),
    zhSeoTitle: stringValue(formData, "zhSeoTitle"),
    zhSeoDescription: stringValue(formData, "zhSeoDescription"),
    publishedAt: stringValue(formData, "publishedAt"),
    featured: booleanValue(formData, "featured"),
    pinned: booleanValue(formData, "pinned"),
    readingTimeMinutes: stringValue(formData, "readingTimeMinutes"),
    sortOrder: stringValue(formData, "sortOrder"),
    tagIds: formData.getAll("tagIds").map(String).filter(Boolean),
    enTitle: stringValue(formData, "enTitle"),
    enExcerpt: stringValue(formData, "enExcerpt"),
    enContent: stringValue(formData, "enContent"),
    zhTitle: stringValue(formData, "zhTitle"),
    zhExcerpt: stringValue(formData, "zhExcerpt"),
    zhContent: stringValue(formData, "zhContent")
  };
}

function toNullable(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toRequiredText(value: string | undefined) {
  return value?.trim() ?? "";
}

function publishedAtValue(value: string | undefined, status: string) {
  if (value) return new Date(value);
  if (status === "published") return new Date();
  return null;
}

async function resolveCoverImage(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  {
    coverImageId,
    coverImageUrl,
    coverImageAlt,
    fallbackText,
    userId
  }: {
    coverImageId?: string;
    coverImageUrl?: string;
    coverImageAlt?: string;
    fallbackText: string;
    userId: string;
  }
) {
  const requestedId = toNullable(coverImageId);
  const requestedUrl = toRequiredText(coverImageUrl);
  const altText = toRequiredText(coverImageAlt) || fallbackText;

  if (requestedId) {
    const asset = await getMediaAssetWithClient(tx, requestedId);
    if (asset) {
      if (toRequiredText(asset.altText) !== altText) {
        await tx
          .update(mediaAssets)
          .set({ altText, updatedAt: new Date() })
          .where(eq(mediaAssets.id, asset.id));
      }

      return {
        coverImage: asset.url,
        coverImageId: asset.id
      };
    }
  }

  if (!requestedUrl) {
    return {
      coverImage: "",
      coverImageId: null
    };
  }

  const mediaAssetId = await upsertMediaAssetFromUrlWithClient(tx, {
    url: requestedUrl,
    altText,
    caption: fallbackText,
    userId
  });

  return {
    coverImage: requestedUrl,
    coverImageId: mediaAssetId
  };
}

async function upsertPostTranslation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
  const normalizedMark = derivePostMark({
    mark: zhData.mark,
    featured: zhData.featured,
    pinned: zhData.pinned
  });
  const markFlags = postMarkFlags(normalizedMark);
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
          mark: normalizedMark,
          coverImage: coverImage.coverImage,
          coverImageId: coverImage.coverImageId,
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: markFlags.featured,
          pinned: markFlags.pinned,
          sortOrder: data.sortOrder
        })
        .returning({ id: posts.id });

      await upsertPostTranslation(tx, post.id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.enSeoTitle,
        seoDescription: data.enSeoDescription
      });
      await upsertPostTranslation(tx, post.id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.zhSeoTitle,
        seoDescription: data.zhSeoDescription
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
  const normalizedMark = derivePostMark({
    mark: data.mark,
    featured: data.featured,
    pinned: data.pinned
  });
  const markFlags = postMarkFlags(normalizedMark);

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
          mark: normalizedMark,
          coverImage: coverImage.coverImage,
          coverImageId: coverImage.coverImageId,
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: markFlags.featured,
          pinned: markFlags.pinned,
          sortOrder: data.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(posts.id, id));

      await upsertPostTranslation(tx, id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.enSeoTitle,
        seoDescription: data.enSeoDescription
      });
      await upsertPostTranslation(tx, id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.zhSeoTitle,
        seoDescription: data.zhSeoDescription
      });

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
  revalidatePath(`/posts/${id}/edit`);
  return { success: "文章已保存。" };
}

export async function updatePostMarkAction(
  id: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const mark = stringValue(formData, "mark");

  if (!isPostMark(mark)) {
    return { error: "标记数据无效。" };
  }

  try {
    const [updated] = await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const [post] = await tx
        .update(posts)
        .set({
          mark,
          featured: postMarkFlags(mark).featured,
          pinned: postMarkFlags(mark).pinned,
          updatedAt: new Date()
        })
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
        .returning({ id: posts.id });

      return [post];
    });

    if (!updated) {
      return { error: "文章不存在或已删除。" };
    }
  } catch (error) {
    return { error: friendlyDatabaseError(error) };
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${id}/edit`);
  return { success: "标记已更新。" };
}

export async function deletePostAction(formData: FormData) {
  await requireUser();
  const id = stringValue(formData, "id");
  await db
    .update(posts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(posts.id, id));
  revalidatePath("/posts");
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
