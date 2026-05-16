import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  mediaAssets,
  postTags,
  postTranslations,
  posts,
  tags,
  tagTranslations,
  users,
  type PostStatus
} from "@/server/db/schema";

export async function getDashboardStats() {
  const [postCount] = await db
    .select({
      total: count(),
      published: sql<number>`count(*) filter (where ${posts.status} = 'published')`,
      drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`
    })
    .from(posts)
    .where(isNull(posts.deletedAt));

  const [categoryCount] = await db
    .select({ total: count() })
    .from(categories)
    .where(isNull(categories.deletedAt));

  const [tagCount] = await db
    .select({ total: count() })
    .from(tags)
    .where(isNull(tags.deletedAt));

  const recentPosts = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      updatedAt: posts.updatedAt,
      title: postTranslations.title
    })
    .from(posts)
    .innerJoin(
      postTranslations,
      and(eq(postTranslations.postId, posts.id), eq(postTranslations.locale, "en"))
    )
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.updatedAt))
    .limit(6);

  return {
    posts: Number(postCount?.total ?? 0),
    published: Number(postCount?.published ?? 0),
    drafts: Number(postCount?.drafts ?? 0),
    categories: Number(categoryCount?.total ?? 0),
    tags: Number(tagCount?.total ?? 0),
    recentPosts: recentPosts.map((post) => ({
      ...post,
      status: post.status as PostStatus
    }))
  };
}

export async function listPosts(options: {
  query?: string;
  status?: PostStatus | "all";
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = options.pageSize ?? 12;
  const query = options.query?.trim();
  const status = options.status ?? "all";

  const filters = [
    isNull(posts.deletedAt),
    status === "all" ? undefined : eq(posts.status, status),
    query
      ? or(ilike(posts.slug, `%${query}%`), ilike(postTranslations.title, `%${query}%`))
      : undefined
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      featured: posts.featured,
      pinned: posts.pinned,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      title: postTranslations.title,
      categoryName: categoryTranslations.name
    })
    .from(posts)
    .innerJoin(
      postTranslations,
      and(eq(postTranslations.postId, posts.id), eq(postTranslations.locale, "en"))
    )
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, "en")
      )
    )
    .where(where)
    .orderBy(desc(posts.pinned), desc(posts.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db
    .select({ total: count() })
    .from(posts)
    .innerJoin(
      postTranslations,
      and(eq(postTranslations.postId, posts.id), eq(postTranslations.locale, "en"))
    )
    .where(where);

  return {
    rows: rows.map((post) => ({
      ...post,
      status: post.status as PostStatus
    })),
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize
  };
}

export async function getPostEditorOptions() {
  const categoryRows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categoryTranslations.name
    })
    .from(categories)
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, "en")
      )
    )
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder));

  const tagRows = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tagTranslations.name
    })
    .from(tags)
    .innerJoin(
      tagTranslations,
      and(eq(tagTranslations.tagId, tags.id), eq(tagTranslations.locale, "en"))
    )
    .where(isNull(tags.deletedAt))
    .orderBy(asc(tagTranslations.name));

  return { categories: categoryRows, tags: tagRows };
}

export async function getPostForEdit(id: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post || post.deletedAt) return null;

  const translations = await db
    .select()
    .from(postTranslations)
    .where(eq(postTranslations.postId, id));

  const selectedTags = await db
    .select({ tagId: postTags.tagId })
    .from(postTags)
    .where(eq(postTags.postId, id));

  const [coverAsset] = post.coverImageId
    ? await db
        .select({ altText: mediaAssets.altText })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, post.coverImageId))
        .limit(1)
    : [];

  return {
    ...post,
    status: post.status as PostStatus,
    coverImageUrl: post.coverImage,
    coverImageAlt: coverAsset?.altText ?? "",
    seoTitle:
      translations.find((translation) => translation.locale === "en")?.seoTitle ??
      "",
    seoDescription:
      translations.find((translation) => translation.locale === "en")
        ?.seoDescription ?? "",
    readingTimeMinutes:
      translations.find((translation) => translation.locale === "en")
        ?.readingMinutes ?? 1,
    translations: translations.map((translation) => ({
      ...translation,
      locale: translation.locale as "en" | "zh"
    })),
    tagIds: selectedTags.map((tag) => tag.tagId)
  };
}

export async function listCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      seoTitle: categories.seoTitle,
      seoDescription: categories.seoDescription,
      updatedAt: categories.updatedAt,
      enName: sql<string>`max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en')`,
      zhName: sql<string>`max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh')`
    })
    .from(categories)
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .where(isNull(categories.deletedAt))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));
}

export async function getCategoryForEdit(id: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
    .limit(1);
  if (!category) return null;

  const translations = await db
    .select()
    .from(categoryTranslations)
    .where(eq(categoryTranslations.categoryId, id));

  return {
    ...category,
    translations: translations.map((translation) => ({
      ...translation,
      locale: translation.locale as "en" | "zh"
    }))
  };
}

export async function listTags(query?: string) {
  const filters = [
    isNull(tags.deletedAt),
    query?.trim()
      ? or(ilike(tags.slug, `%${query.trim()}%`), ilike(tagTranslations.name, `%${query.trim()}%`))
      : undefined
  ].filter(Boolean);

  return db
    .select({
      id: tags.id,
      slug: tags.slug,
      seoTitle: tags.seoTitle,
      seoDescription: tags.seoDescription,
      updatedAt: tags.updatedAt,
      enName: sql<string>`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'en')`,
      zhName: sql<string>`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'zh')`,
      postCount: sql<number>`count(distinct ${postTags.postId})`
    })
    .from(tags)
    .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(tags.id)
    .orderBy(asc(sql`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'en')`));
}

export async function getTagForEdit(id: string) {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);
  if (!tag) return null;

  const translations = await db
    .select()
    .from(tagTranslations)
    .where(eq(tagTranslations.tagId, id));

  return {
    ...tag,
    translations: translations.map((translation) => ({
      ...translation,
      locale: translation.locale as "en" | "zh"
    }))
  };
}

export async function listUsers() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.email));

  return rows.map((user) => ({
    ...user,
    role: user.role as "admin" | "editor"
  }));
}

export async function getRelatedPostsForPost(postId: string, limit = 6) {
  const [post] = await db
    .select({ categoryId: posts.categoryId })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);

  if (!post) return [];

  const tagRows = await db
    .select({ tagId: postTags.tagId })
    .from(postTags)
    .where(eq(postTags.postId, postId));

  const tagIds = tagRows.map((tag) => tag.tagId);
  const scoreExpression = sql<number>`
    case when ${posts.categoryId} = ${post.categoryId} then 2 else 0 end +
    count(${postTags.tagId})
  `;

  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: postTranslations.title,
      score: scoreExpression
    })
    .from(posts)
    .innerJoin(
      postTranslations,
      and(eq(postTranslations.postId, posts.id), eq(postTranslations.locale, "en"))
    )
    .leftJoin(postTags, eq(postTags.postId, posts.id))
    .where(
      and(
        isNull(posts.deletedAt),
        eq(posts.status, "published"),
        sql`${posts.id} <> ${postId}`,
        tagIds.length
          ? or(eq(posts.categoryId, post.categoryId), inArray(postTags.tagId, tagIds))
          : eq(posts.categoryId, post.categoryId)
      )
    )
    .groupBy(posts.id, postTranslations.title)
    .orderBy(desc(scoreExpression), desc(posts.publishedAt))
    .limit(limit);
}
