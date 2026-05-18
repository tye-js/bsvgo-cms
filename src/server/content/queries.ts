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
      title: sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), ${posts.slug})`
    })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(isNull(posts.deletedAt))
    .groupBy(posts.id)
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
  const titleExpression = sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), ${posts.slug})`;
  const categoryNameExpression = sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en'), ''), nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), ${categories.slug})`;

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
      title: titleExpression,
      categoryName: categoryNameExpression
    })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .where(where)
    .groupBy(posts.id, categories.id)
    .orderBy(desc(posts.pinned), desc(posts.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db
    .select({ total: sql<number>`count(distinct ${posts.id})` })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
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
      name: sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en'), ''), nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), ${categories.slug})`
    })
    .from(categories)
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .where(isNull(categories.deletedAt))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));

  const tagRows = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      enName: sql<string>`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'en')`,
      zhName: sql<string>`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'zh')`
    })
    .from(tags)
    .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
    .where(isNull(tags.deletedAt))
    .groupBy(tags.id)
    .orderBy(asc(sql`max(${tagTranslations.name}) filter (where ${tagTranslations.locale} = 'en')`));

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
    coverImageId: post.coverImageId,
    coverImageUrl: post.coverImage,
    coverImageAlt: coverAsset?.altText ?? "",
    enSeoTitle:
      translations.find((translation) => translation.locale === "en")?.seoTitle ??
      "",
    enSeoDescription:
      translations.find((translation) => translation.locale === "en")
        ?.seoDescription ?? "",
    zhSeoTitle:
      translations.find((translation) => translation.locale === "zh")?.seoTitle ??
      "",
    zhSeoDescription:
      translations.find((translation) => translation.locale === "zh")
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
      zhName: sql<string>`max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh')`,
      enSeoTitle: sql<string>`coalesce(nullif(max(${categoryTranslations.seoTitle}) filter (where ${categoryTranslations.locale} = 'en'), ''), ${categories.seoTitle}, '')`,
      enSeoDescription: sql<string>`coalesce(nullif(max(${categoryTranslations.seoDescription}) filter (where ${categoryTranslations.locale} = 'en'), ''), ${categories.seoDescription}, '')`,
      zhSeoTitle: sql<string>`coalesce(max(${categoryTranslations.seoTitle}) filter (where ${categoryTranslations.locale} = 'zh'), '')`,
      zhSeoDescription: sql<string>`coalesce(max(${categoryTranslations.seoDescription}) filter (where ${categoryTranslations.locale} = 'zh'), '')`
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
      enSeoTitle: sql<string>`coalesce(nullif(max(${tagTranslations.seoTitle}) filter (where ${tagTranslations.locale} = 'en'), ''), ${tags.seoTitle}, '')`,
      enSeoDescription: sql<string>`coalesce(nullif(max(${tagTranslations.seoDescription}) filter (where ${tagTranslations.locale} = 'en'), ''), ${tags.seoDescription}, '')`,
      zhSeoTitle: sql<string>`coalesce(max(${tagTranslations.seoTitle}) filter (where ${tagTranslations.locale} = 'zh'), '')`,
      zhSeoDescription: sql<string>`coalesce(max(${tagTranslations.seoDescription}) filter (where ${tagTranslations.locale} = 'zh'), '')`,
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
  const enTranslation = translations.find((translation) => translation.locale === "en");
  const zhTranslation =
    translations.find((translation) => translation.locale === "zh") ??
    (enTranslation
      ? {
          ...enTranslation,
          locale: "zh",
          name: enTranslation.name,
          description: "",
          seoTitle: "",
          seoDescription: ""
        }
      : undefined);
  const normalizedTranslations = [];
  if (enTranslation) normalizedTranslations.push(enTranslation);
  if (zhTranslation) normalizedTranslations.push(zhTranslation);

  return {
    ...tag,
    translations: normalizedTranslations.map((translation) => ({
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
    count(distinct ${postTags.tagId})
  `;
  const titleExpression = sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), ${posts.slug})`;

  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: titleExpression,
      score: scoreExpression
    })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
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
    .groupBy(posts.id)
    .orderBy(desc(scoreExpression), desc(posts.publishedAt))
    .limit(limit);
}
