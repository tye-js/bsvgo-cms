import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { isAiWritingRoleId } from "@/lib/ai-style";
import { db } from "@/server/db";
import {
  categories,
  categoryTranslations,
  mediaAssets,
  postPlacements,
  postTags,
  postTranslations,
  posts,
  tags,
  tagTranslations,
  users,
  type Locale,
  type PostMark,
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
      mark: posts.mark,
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
      mark: post.mark as PostMark,
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
  const titleExpression = sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), ${posts.slug})`;
  const categoryNameExpression = sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en'), ''), ${categories.slug})`;

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
      mark: posts.mark,
      aiAuthorRole: posts.aiAuthorRole,
      aiAuthorZhName: posts.aiAuthorZhName,
      aiAuthorEnName: posts.aiAuthorEnName,
      aiAuthorAvatar: posts.aiAuthorAvatar,
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
      mark: post.mark as PostMark,
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
        .select({
          altText: mediaAssets.altText,
          zhAltText: mediaAssets.zhAltText,
          enAltText: mediaAssets.enAltText
        })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, post.coverImageId))
        .limit(1)
    : [];
  const aiAuthorRole = post.aiAuthorRole ?? "";

  return {
    ...post,
    mark: post.mark as PostMark,
    status: post.status as PostStatus,
    aiAuthorRole: isAiWritingRoleId(aiAuthorRole) ? aiAuthorRole : null,
    coverImageId: post.coverImageId,
    coverImageUrl: post.coverImage,
    coverImageAlt:
      coverAsset?.zhAltText || coverAsset?.altText || coverAsset?.enAltText || "",
    enSeoTitle:
      translations.find((translation) => translation.locale === "en")?.seoTitle ??
      "",
    enSeoDescription:
      translations.find((translation) => translation.locale === "en")
        ?.seoDescription ?? "",
    enCanonicalUrl:
      translations.find((translation) => translation.locale === "en")
        ?.canonicalUrl ?? "",
    enOgImage:
      translations.find((translation) => translation.locale === "en")?.ogImage ??
      "",
    enStructuredData: JSON.stringify(
      translations.find((translation) => translation.locale === "en")
        ?.structuredData ?? {},
      null,
      2
    ),
    zhSeoTitle:
      translations.find((translation) => translation.locale === "zh")?.seoTitle ??
      "",
    zhSeoDescription:
      translations.find((translation) => translation.locale === "zh")
        ?.seoDescription ?? "",
    zhCanonicalUrl:
      translations.find((translation) => translation.locale === "zh")
        ?.canonicalUrl ?? "",
    zhOgImage:
      translations.find((translation) => translation.locale === "zh")?.ogImage ??
      "",
    zhStructuredData: JSON.stringify(
      translations.find((translation) => translation.locale === "zh")
        ?.structuredData ?? {},
      null,
      2
    ),
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

export type SeoAuditIssue =
  | "missing_title"
  | "missing_description"
  | "description_short"
  | "description_long"
  | "duplicate_seo";

const seoIssueLabels: Record<SeoAuditIssue, string> = {
  missing_title: "缺 title",
  missing_description: "缺 description",
  description_short: "描述过短",
  description_long: "描述过长",
  duplicate_seo: "重复 SEO"
};

function normalizedSeoKey(title: string, description: string) {
  return `${title.trim().toLowerCase()}:::${description.trim().toLowerCase()}`;
}

function descriptionRange(locale: string) {
  return locale === "zh" ? { min: 50, max: 160 } : { min: 80, max: 170 };
}

export async function listSeoAuditPosts(options: {
  issue?: SeoAuditIssue | "all";
  locale?: Locale | "all";
  query?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const issue = options.issue ?? "all";
  const locale = options.locale ?? "all";
  const query = options.query?.trim().toLowerCase();
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = options.pageSize ?? 20;

  const rows = await db
    .select({
      postId: posts.id,
      slug: posts.slug,
      status: posts.status,
      updatedAt: posts.updatedAt,
      locale: postTranslations.locale,
      title: postTranslations.title,
      seoTitle: postTranslations.seoTitle,
      seoDescription: postTranslations.seoDescription,
      canonicalUrl: postTranslations.canonicalUrl,
      ogImage: postTranslations.ogImage,
      structuredData: postTranslations.structuredData
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.updatedAt));

  const duplicateCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.seoTitle.trim() || !row.seoDescription.trim()) continue;
    const key = `${row.locale}:${normalizedSeoKey(row.seoTitle, row.seoDescription)}`;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  const auditedRows = rows.map((row) => {
    const range = descriptionRange(row.locale);
    const descriptionLength = row.seoDescription.trim().length;
    const issues: SeoAuditIssue[] = [];

    if (!row.seoTitle.trim()) issues.push("missing_title");
    if (!row.seoDescription.trim()) issues.push("missing_description");
    if (row.seoDescription.trim() && descriptionLength < range.min) {
      issues.push("description_short");
    }
    if (descriptionLength > range.max) issues.push("description_long");
    if (
      row.seoTitle.trim() &&
      row.seoDescription.trim() &&
      (duplicateCounts.get(
        `${row.locale}:${normalizedSeoKey(row.seoTitle, row.seoDescription)}`
      ) ?? 0) > 1
    ) {
      issues.push("duplicate_seo");
    }

    return {
      ...row,
      locale: row.locale as Locale,
      status: row.status as PostStatus,
      descriptionLength,
      issues,
      issueLabels: issues.map((item) => seoIssueLabels[item])
    };
  });

  const filteredRows = auditedRows.filter((row) => {
    if (locale !== "all" && row.locale !== locale) return false;
    if (issue !== "all" && !row.issues.includes(issue)) return false;
    if (!query) return true;
    return (
      row.slug.toLowerCase().includes(query) ||
      row.title.toLowerCase().includes(query) ||
      row.seoTitle.toLowerCase().includes(query) ||
      row.seoDescription.toLowerCase().includes(query)
    );
  });

  const issueCounts = auditedRows.reduce(
    (counts, row) => {
      for (const rowIssue of row.issues) counts[rowIssue] += 1;
      return counts;
    },
    {
      missing_title: 0,
      missing_description: 0,
      description_short: 0,
      description_long: 0,
      duplicate_seo: 0
    } satisfies Record<SeoAuditIssue, number>
  );

  return {
    rows: filteredRows.slice((page - 1) * pageSize, page * pageSize),
    total: filteredRows.length,
    page,
    pageSize,
    issueCounts,
    issueLabels: seoIssueLabels
  };
}

export async function listPlacementPosts(options: {
  query?: string;
  status?: PostStatus | "all";
  categoryId?: string | "all";
  placement?: "all" | "homeFeatured" | "homePromoted" | "categoryFeatured" | "categoryPromoted";
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = options.pageSize ?? 12;
  const query = options.query?.trim();
  const status = options.status ?? "all";
  const categoryId = options.categoryId ?? "all";
  const placement = options.placement ?? "all";
  const titleExpression = sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), ${posts.slug})`;
  const categoryNameExpression = sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en'), ''), ${categories.slug})`;
  const placementFilters: Record<
    Exclude<typeof placement, "all">,
    { scope: "home" | "category"; slot: "featured" | "promoted" }
  > = {
    homeFeatured: { scope: "home", slot: "featured" },
    homePromoted: { scope: "home", slot: "promoted" },
    categoryFeatured: { scope: "category", slot: "featured" },
    categoryPromoted: { scope: "category", slot: "promoted" }
  };
  const selectedPlacement =
    placement === "all" ? null : placementFilters[placement];
  const filters = [
    isNull(posts.deletedAt),
    status === "all" ? undefined : eq(posts.status, status),
    categoryId === "all" ? undefined : eq(posts.categoryId, categoryId),
    query
      ? or(ilike(posts.slug, `%${query}%`), ilike(postTranslations.title, `%${query}%`))
      : undefined
  ].filter(Boolean);
  const placementWhere = selectedPlacement
    ? and(
        eq(postPlacements.scope, selectedPlacement.scope),
        eq(postPlacements.slot, selectedPlacement.slot),
        eq(postPlacements.enabled, true)
      )
    : undefined;
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      categoryId: posts.categoryId,
      title: titleExpression,
      categoryName: categoryNameExpression,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt
    })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .$dynamic()
    .where(
      placementWhere
        ? and(
            where,
            sql`exists (
              select 1
              from ${postPlacements}
              where ${postPlacements.postId} = ${posts.id}
                and ${placementWhere}
            )`
          )
        : where
    )
    .groupBy(posts.id, categories.id)
    .orderBy(desc(posts.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db
    .select({ total: sql<number>`count(distinct ${posts.id})` })
    .from(posts)
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .$dynamic()
    .where(
      placementWhere
        ? and(
            where,
            sql`exists (
              select 1
              from ${postPlacements}
              where ${postPlacements.postId} = ${posts.id}
                and ${placementWhere}
            )`
          )
        : where
    );

  const placements = rows.length
    ? await db
        .select()
        .from(postPlacements)
        .where(inArray(postPlacements.postId, rows.map((post) => post.id)))
    : [];

  return {
    rows: rows.map((post) => {
    const postPlacements = placements.filter(
      (placement) => placement.postId === post.id
    );

    return {
      ...post,
      status: post.status as PostStatus,
      placements: {
        homeFeatured:
          postPlacements.find(
            (placement) =>
              placement.scope === "home" && placement.slot === "featured"
          ) ?? null,
        homePromoted:
          postPlacements.find(
            (placement) =>
              placement.scope === "home" && placement.slot === "promoted"
          ) ?? null,
        categoryFeatured:
          postPlacements.find(
            (placement) =>
              placement.scope === "category" && placement.slot === "featured"
          ) ?? null,
        categoryPromoted:
          postPlacements.find(
            (placement) =>
              placement.scope === "category" && placement.slot === "promoted"
          ) ?? null
      }
    };
  }),
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize
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
