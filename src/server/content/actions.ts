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
  postTags,
  posts,
  tagTranslations,
  tags,
  users
} from "@/server/db/schema";
import { aiAuthorValues } from "@/server/content/ai-author";
import { resolveCoverImage } from "@/server/content/cover-image";
import { friendlyAiError, friendlyDatabaseError } from "@/server/content/errors";
import { postDataFromForm, stringValue } from "@/server/content/form-data";
import {
  fallbackSlug,
  publishedAtValue,
  toNullable,
  toRequiredText
} from "@/server/content/normalizers";
import {
  deriveLegacyPostFlags,
  replacePostPlacements
} from "@/server/content/placements";
import { upsertPostTranslation } from "@/server/content/translations";

type ActionState = {
  error?: string;
  success?: string;
};

const POST_WRITE_TIMEOUT = sql`set local statement_timeout = '15s'`;

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
  const legacyFlags = deriveLegacyPostFlags(zhData.placements, zhData.mark);
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
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: legacyFlags.featured,
          pinned: legacyFlags.pinned,
          sortOrder: data.sortOrder
        })
        .returning({ id: posts.id });

      await replacePostPlacements(tx, post.id, data.categoryId, data.placements);

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
  const legacyFlags = deriveLegacyPostFlags(data.placements, data.mark);

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
          mark: legacyFlags.mark,
          ...aiAuthorValues(data.writingRole),
          coverImage: coverImage.coverImage,
          coverImageId: coverImage.coverImageId,
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: legacyFlags.featured,
          pinned: legacyFlags.pinned,
          sortOrder: data.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(posts.id, id));

      await replacePostPlacements(tx, id, data.categoryId, data.placements);

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
