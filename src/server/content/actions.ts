"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";

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
  postTranslations,
  posts,
  tagTranslations,
  tags,
  users,
  type Locale
} from "@/server/db/schema";
import { upsertMediaAssetFromUrlWithClient } from "@/server/media/service";

type ActionState = {
  error?: string;
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
    return "A record with the same slug already exists. Use a unique slug and try again.";
  }

  if (
    codes.includes("57014") ||
    message.includes("statement timeout") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("timeout exceeded") ||
    message.includes("Connection terminated")
  ) {
    return "Saving timed out. Check the database connection and try again.";
  }

  return "Saving failed. Please try again.";
}

function friendlyAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("AI OpenAI API key is not configured") ||
    message.includes("app_settings")
  ) {
    return "AI is not configured. Open Settings and save the OpenAI API key before creating a post.";
  }

  if (message.includes("timed out")) {
    return "English generation timed out. Please try again.";
  }

  return "English generation failed. Please check the AI configuration and try again.";
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function postDataFromForm(formData: FormData) {
  return {
    slug: stringValue(formData, "slug"),
    categoryId: stringValue(formData, "categoryId"),
    status: stringValue(formData, "status"),
    coverImageUrl: stringValue(formData, "coverImageUrl"),
    coverImageAlt: stringValue(formData, "coverImageAlt"),
    seoTitle: stringValue(formData, "seoTitle"),
    seoDescription: stringValue(formData, "seoDescription"),
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid post data" };
  }

  const zhData = parsed.data;
  const english = await generateEnglishPost({
    title: zhData.zhTitle,
    excerpt: zhData.zhExcerpt,
    content: zhData.zhContent
  }).catch((error) => ({ error: friendlyAiError(error) }));

  if ("error" in english) {
    return english;
  }

  const data = {
    ...zhData,
    enTitle: english.title,
    enExcerpt: english.excerpt,
    enContent: english.content,
    seoTitle: english.seoTitle || zhData.seoTitle,
    seoDescription: english.seoDescription || zhData.seoDescription
  };

  let createdId: string;

  try {
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const coverImageUrl = toRequiredText(data.coverImageUrl);
      const coverImageText = data.enTitle || data.zhTitle || data.slug;
      const coverImageId = coverImageUrl
        ? await upsertMediaAssetFromUrlWithClient(tx, {
            url: coverImageUrl,
            altText: data.coverImageAlt || coverImageText,
            caption: coverImageText,
            userId: user.id
          })
        : null;

      const [post] = await tx
        .insert(posts)
        .values({
          slug: data.slug,
          categoryId: data.categoryId,
          authorId: user.id,
          status: data.status,
          coverImage: coverImageUrl,
          coverImageId,
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: data.featured,
          pinned: data.pinned,
          sortOrder: data.sortOrder
        })
        .returning({ id: posts.id });

      await upsertPostTranslation(tx, post.id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription
      });
      await upsertPostTranslation(tx, post.id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid post data" };
  }

  const data = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(POST_WRITE_TIMEOUT);
      const coverImageUrl = toRequiredText(data.coverImageUrl);
      const coverImageText = data.enTitle || data.zhTitle || data.slug;
      const coverImageId = coverImageUrl
        ? await upsertMediaAssetFromUrlWithClient(tx, {
            url: coverImageUrl,
            altText: data.coverImageAlt || coverImageText,
            caption: coverImageText,
            userId: user.id
          })
        : null;

      await tx
        .update(posts)
        .set({
          slug: data.slug,
          categoryId: data.categoryId,
          status: data.status,
          coverImage: coverImageUrl,
          coverImageId,
          publishedAt: publishedAtValue(data.publishedAt, data.status),
          featured: data.featured,
          pinned: data.pinned,
          sortOrder: data.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(posts.id, id));

      await upsertPostTranslation(tx, id, "en", {
        title: data.enTitle,
        excerpt: data.enExcerpt,
        content: data.enContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription
      });
      await upsertPostTranslation(tx, id, "zh", {
        title: data.zhTitle,
        excerpt: data.zhExcerpt,
        content: data.zhContent,
        readingMinutes: data.readingTimeMinutes,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription
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
  return {};
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
    seoTitle: stringValue(formData, "seoTitle"),
    seoDescription: stringValue(formData, "seoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category data" };
  }

  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({
        seoTitle: toNullable(data.seoTitle),
        seoDescription: toNullable(data.seoDescription),
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
              : toRequiredText(data.zhDescription)
        })
        .onConflictDoUpdate({
          target: [categoryTranslations.categoryId, categoryTranslations.locale],
          set: {
            name: locale === "en" ? data.enName : data.zhName,
            description:
              locale === "en"
                ? toRequiredText(data.enDescription)
                : toRequiredText(data.zhDescription),
            updatedAt: new Date()
          }
        });
    }
  });

  revalidatePath("/categories");
  revalidatePath(`/categories/${id}/edit`);
  return {};
}

export async function createTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const parsed = tagSchema.safeParse({
    slug: stringValue(formData, "slug"),
    seoTitle: stringValue(formData, "seoTitle"),
    seoDescription: stringValue(formData, "seoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tag data" };
  }

  const data = parsed.data;

  const [created] = await db.transaction(async (tx) => {
    const [tag] = await tx
      .insert(tags)
      .values({
        name: data.enName,
        slug: data.slug,
        seoTitle: toNullable(data.seoTitle),
        seoDescription: toNullable(data.seoDescription)
      })
      .returning({ id: tags.id });

    await tx.insert(tagTranslations).values({
      tagId: tag.id,
      locale: "en",
      name: data.enName,
      description: toRequiredText(data.enDescription)
    });

    if (data.zhName || data.zhDescription) {
      await tx.insert(tagTranslations).values({
        tagId: tag.id,
        locale: "zh",
        name: data.zhName || data.enName,
        description: toRequiredText(data.zhDescription)
      });
    }

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
    seoTitle: stringValue(formData, "seoTitle"),
    seoDescription: stringValue(formData, "seoDescription"),
    enName: stringValue(formData, "enName"),
    enDescription: stringValue(formData, "enDescription"),
    zhName: stringValue(formData, "zhName"),
    zhDescription: stringValue(formData, "zhDescription")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tag data" };
  }

  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(tags)
      .set({
        slug: data.slug,
        name: data.enName,
        seoTitle: toNullable(data.seoTitle),
        seoDescription: toNullable(data.seoDescription),
        updatedAt: new Date()
      })
      .where(eq(tags.id, id));

    await tx
      .insert(tagTranslations)
      .values({
        tagId: id,
        locale: "en",
        name: data.enName,
        description: toRequiredText(data.enDescription)
      })
      .onConflictDoUpdate({
        target: [tagTranslations.tagId, tagTranslations.locale],
        set: {
          name: data.enName,
          description: toRequiredText(data.enDescription)
        }
      });

    if (data.zhName || data.zhDescription) {
      await tx
        .insert(tagTranslations)
        .values({
          tagId: id,
          locale: "zh",
          name: data.zhName || data.enName,
          description: toRequiredText(data.zhDescription)
        })
        .onConflictDoUpdate({
          target: [tagTranslations.tagId, tagTranslations.locale],
          set: {
            name: data.zhName || data.enName,
            description: toRequiredText(data.zhDescription)
          }
        });
    } else {
      await tx
        .delete(tagTranslations)
        .where(and(eq(tagTranslations.tagId, id), eq(tagTranslations.locale, "zh")));
    }
  });

  revalidatePath("/tags");
  revalidatePath(`/tags/${id}/edit`);
  return {};
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid user data" };
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
