import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "@/server/db";
import {
  analyticsEvents,
  categories,
  categoryTranslations,
  postPlacements,
  posts,
  postTranslations,
  type AnalyticsEventName,
  type Locale
} from "@/server/db/schema";

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const MAX_OFFSET = 10000;

export const analyticsEventNames = [
  "page_view",
  "article_view",
  "article_click",
  "category_click",
  "tag_click",
  "nav_click",
  "locale_switch",
  "section_jump",
  "section_view",
  "outbound_click",
  "article_depth"
] as const satisfies AnalyticsEventName[];

const analyticsEventNameSet = new Set<string>(analyticsEventNames);

export const contentOptimizationIssueTypes = [
  "high_click_low_engagement",
  "low_click_high_value",
  "stale_content",
  "seo_gap",
  "cover_gap"
] as const;

export type ContentOptimizationIssueType =
  (typeof contentOptimizationIssueTypes)[number];

export class AnalyticsQueryError extends Error {
  status = 400;
}

export type AnalyticsFilters = {
  from: Date;
  to: Date;
  locale?: Locale;
  limit: number;
  offset: number;
  eventName?: AnalyticsEventName;
};

type ParseFilterOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  includeEventName?: boolean;
};

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function clampInteger(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseDateBoundary(value: string | null, boundary: "start" | "end") {
  if (!value) return null;

  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const date = dateOnly ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    throw new AnalyticsQueryError("时间范围参数无效，请使用 ISO 时间或 YYYY-MM-DD。");
  }

  if (dateOnly && boundary === "end") {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function parseLocale(value: string | null) {
  if (!value) return undefined;
  if (value === "en" || value === "zh") return value;
  throw new AnalyticsQueryError("locale 仅支持 en 或 zh。");
}

function parseEventName(value: string | null) {
  if (!value) return undefined;
  if (analyticsEventNameSet.has(value)) return value as AnalyticsEventName;
  throw new AnalyticsQueryError("eventName 不是当前支持的事件类型。");
}

export function parseAnalyticsFilters(
  searchParams: URLSearchParams,
  options: ParseFilterOptions = {}
): AnalyticsFilters {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const to = parseDateBoundary(searchParams.get("to"), "end") ?? new Date();
  const from =
    parseDateBoundary(searchParams.get("from"), "start") ??
    new Date(to.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);

  if (from >= to) {
    throw new AnalyticsQueryError("from 必须早于 to。");
  }

  const eventName = options.includeEventName
    ? parseEventName(searchParams.get("eventName") ?? searchParams.get("event_name"))
    : undefined;

  return {
    from,
    to,
    locale: parseLocale(searchParams.get("locale")),
    limit: clampInteger(searchParams.get("limit"), defaultLimit, 1, maxLimit),
    offset: clampInteger(searchParams.get("offset"), 0, 0, MAX_OFFSET),
    eventName
  };
}

function range(filters: AnalyticsFilters) {
  return {
    from: filters.from.toISOString(),
    to: filters.to.toISOString(),
    locale: filters.locale ?? "all"
  };
}

function analyticsWhere(filters: AnalyticsFilters, ...extra: SQL[]) {
  const conditions: SQL[] = [
    gte(analyticsEvents.createdAt, filters.from),
    lt(analyticsEvents.createdAt, filters.to)
  ];

  if (filters.locale) {
    conditions.push(eq(analyticsEvents.locale, filters.locale));
  }

  if (filters.eventName) {
    conditions.push(eq(analyticsEvents.eventName, filters.eventName));
  }

  conditions.push(...extra);

  return and(...conditions) ?? sql`true`;
}

function nonEmptyArticleSlug() {
  return sql`${analyticsEvents.articleSlug} is not null and ${analyticsEvents.articleSlug} <> ''`;
}

function nonEmptyCategorySlug() {
  return sql`${analyticsEvents.categorySlug} is not null and ${analyticsEvents.categorySlug} <> ''`;
}

function nonEmptyTagSlug() {
  return sql`${analyticsEvents.tagSlug} is not null and ${analyticsEvents.tagSlug} <> ''`;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio))
  );
  return sorted[index] ?? 0;
}

function daysSince(date: Date | null) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function contentOptimizationTypeLabel(type: ContentOptimizationIssueType) {
  const labels: Record<ContentOptimizationIssueType, string> = {
    high_click_low_engagement: "高点击低停留",
    low_click_high_value: "低点击高价值",
    stale_content: "过期内容",
    seo_gap: "SEO 缺口",
    cover_gap: "封面缺口"
  };

  return labels[type];
}

function contentOptimizationAction(type: ContentOptimizationIssueType) {
  const actions: Record<
    ContentOptimizationIssueType,
    { label: string; recommendation: string }
  > = {
    high_click_low_engagement: {
      label: "改标题与开头",
      recommendation:
        "检查标题承诺、摘要和首屏内容是否一致，重写开头段落，补强小标题，让读者更快看到文章价值。"
    },
    low_click_high_value: {
      label: "改标题与换封面",
      recommendation:
        "优化列表标题、SEO title 和封面主视觉，把推荐位价值点提前表达，提升首页或分类页点击率。"
    },
    stale_content: {
      label: "更新内容",
      recommendation:
        "补充最新事实、版本、链接和上下文，清理过期描述，必要时重新生成 SEO 摘要和封面。"
    },
    seo_gap: {
      label: "补 SEO",
      recommendation:
        "补全中英文 SEO title 和 description，让搜索入口、分享卡片和文章页元信息保持完整。"
    },
    cover_gap: {
      label: "换封面",
      recommendation:
        "生成或上传主封面图，并补齐双语替换文本和图片 SEO 信息，提升列表识别度。"
    }
  };

  return actions[type];
}

export async function getContentOptimizationOpportunities({
  days = 30,
  type = "all",
  limit = 80
}: {
  days?: number;
  type?: ContentOptimizationIssueType | "all";
  limit?: number;
} = {}) {
  const safeDays = Math.min(Math.max(days, 7), 365);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const to = new Date();
  const from = new Date(to.getTime() - safeDays * 24 * 60 * 60 * 1000);

  const metricsRows = await db
    .select({
      articleSlug: analyticsEvents.articleSlug,
      views: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'article_view')`,
      clicks: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'article_click')`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.eventName} in ('article_view', 'article_click'))`,
      sectionViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'section_view')`,
      outboundClicks: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'outbound_click')`,
      depthEvents: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'article_depth')`,
      avgDepth: sql<number>`coalesce(avg(${analyticsEvents.value}) filter (where ${analyticsEvents.eventName} = 'article_depth' and ${analyticsEvents.value} is not null), 0)`,
      maxDepth: sql<number>`coalesce(max(${analyticsEvents.value}) filter (where ${analyticsEvents.eventName} = 'article_depth' and ${analyticsEvents.value} is not null), 0)`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(
        { from, to, limit: 500, offset: 0 },
        nonEmptyArticleSlug()
      )
    )
    .groupBy(analyticsEvents.articleSlug);

  const metricsBySlug = new Map(
    metricsRows.map((row) => [
      row.articleSlug ?? "",
      {
        views: toNumber(row.views),
        clicks: toNumber(row.clicks),
        visitors: toNumber(row.visitors),
        sectionViews: toNumber(row.sectionViews),
        outboundClicks: toNumber(row.outboundClicks),
        depthEvents: toNumber(row.depthEvents),
        avgDepth: Math.round(toNumber(row.avgDepth)),
        maxDepth: toNumber(row.maxDepth)
      }
    ])
  );

  const postRows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      featured: posts.featured,
      pinned: posts.pinned,
      mark: posts.mark,
      coverImage: posts.coverImage,
      coverImageId: posts.coverImageId,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      title: sql<string>`coalesce(nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.title}) filter (where ${postTranslations.locale} = 'en'), ''), ${posts.slug})`,
      excerpt: sql<string>`coalesce(nullif(max(${postTranslations.excerpt}) filter (where ${postTranslations.locale} = 'zh'), ''), nullif(max(${postTranslations.excerpt}) filter (where ${postTranslations.locale} = 'en'), ''), '')`,
      zhSeoTitle: sql<string>`coalesce(max(${postTranslations.seoTitle}) filter (where ${postTranslations.locale} = 'zh'), '')`,
      zhSeoDescription: sql<string>`coalesce(max(${postTranslations.seoDescription}) filter (where ${postTranslations.locale} = 'zh'), '')`,
      enSeoTitle: sql<string>`coalesce(max(${postTranslations.seoTitle}) filter (where ${postTranslations.locale} = 'en'), '')`,
      enSeoDescription: sql<string>`coalesce(max(${postTranslations.seoDescription}) filter (where ${postTranslations.locale} = 'en'), '')`,
      categorySlug: categories.slug,
      categoryName: sql<string>`coalesce(nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'zh'), ''), nullif(max(${categoryTranslations.name}) filter (where ${categoryTranslations.locale} = 'en'), ''), ${categories.slug})`,
      homeFeatured: sql<number>`count(distinct ${postPlacements.id}) filter (where ${postPlacements.scope} = 'home' and ${postPlacements.slot} = 'featured' and ${postPlacements.enabled} = true)`,
      homePromoted: sql<number>`count(distinct ${postPlacements.id}) filter (where ${postPlacements.scope} = 'home' and ${postPlacements.slot} = 'promoted' and ${postPlacements.enabled} = true)`,
      categoryFeatured: sql<number>`count(distinct ${postPlacements.id}) filter (where ${postPlacements.scope} = 'category' and ${postPlacements.slot} = 'featured' and ${postPlacements.enabled} = true)`,
      categoryPromoted: sql<number>`count(distinct ${postPlacements.id}) filter (where ${postPlacements.scope} = 'category' and ${postPlacements.slot} = 'promoted' and ${postPlacements.enabled} = true)`
    })
    .from(posts)
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .leftJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .leftJoin(postPlacements, eq(postPlacements.postId, posts.id))
    .where(and(isNull(posts.deletedAt), eq(posts.status, "published")))
    .groupBy(posts.id, categories.id)
    .orderBy(desc(posts.updatedAt))
    .limit(500);

  const attentionValues = postRows
    .map((post) => {
      const metrics = metricsBySlug.get(post.slug);
      return (metrics?.views ?? 0) + (metrics?.clicks ?? 0);
    })
    .filter((value) => value > 0);
  const clickValues = postRows
    .map((post) => metricsBySlug.get(post.slug)?.clicks ?? 0)
    .filter((value) => value > 0);
  const highAttentionThreshold = Math.max(10, percentile(attentionValues, 0.75));
  const lowClickThreshold = Math.max(2, percentile(clickValues, 0.25));

  const opportunities = postRows.flatMap((post) => {
    const metrics = metricsBySlug.get(post.slug) ?? {
      views: 0,
      clicks: 0,
      visitors: 0,
      sectionViews: 0,
      outboundClicks: 0,
      depthEvents: 0,
      avgDepth: 0,
      maxDepth: 0
    };
    const attention = metrics.views + metrics.clicks;
    const seoMissing =
      !hasText(post.zhSeoTitle) ||
      !hasText(post.zhSeoDescription) ||
      !hasText(post.enSeoTitle) ||
      !hasText(post.enSeoDescription);
    const coverMissing = !hasText(post.coverImage) && !post.coverImageId;
    const placementScore =
      toNumber(post.homeFeatured) * 5 +
      toNumber(post.homePromoted) * 4 +
      toNumber(post.categoryFeatured) * 3 +
      toNumber(post.categoryPromoted) * 2;
    const highValue =
      post.pinned ||
      post.featured ||
      Boolean(post.mark) ||
      placementScore > 0 ||
      (!seoMissing && !coverMissing);
    const updatedDays = daysSince(post.updatedAt);
    const publishedDays = daysSince(post.publishedAt);
    const staleDays = updatedDays ?? publishedDays ?? 0;
    const rows: Array<{
      id: string;
      type: ContentOptimizationIssueType;
      typeLabel: string;
      actionLabel: string;
      recommendation: string;
      reason: string;
      score: number;
      post: {
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        categorySlug: string;
        categoryName: string;
        publishedAt: Date | null;
        updatedAt: Date;
        hasCover: boolean;
        seoComplete: boolean;
        placementScore: number;
        pinned: boolean;
        featured: boolean;
        mark: string;
      };
      metrics: typeof metrics;
    }> = [];

    const addOpportunity = (
      issueType: ContentOptimizationIssueType,
      reason: string,
      score: number
    ) => {
      const action = contentOptimizationAction(issueType);
      rows.push({
        id: `${post.id}-${issueType}`,
        type: issueType,
        typeLabel: contentOptimizationTypeLabel(issueType),
        actionLabel: action.label,
        recommendation: action.recommendation,
        reason,
        score,
        post: {
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          categorySlug: post.categorySlug,
          categoryName: post.categoryName,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          hasCover: !coverMissing,
          seoComplete: !seoMissing,
          placementScore,
          pinned: post.pinned,
          featured: post.featured,
          mark: post.mark ?? ""
        },
        metrics
      });
    };

    const lowDepth =
      metrics.depthEvents > 0
        ? metrics.avgDepth > 0 && metrics.avgDepth < 45
        : metrics.sectionViews <= Math.max(1, Math.floor(metrics.views * 0.15));
    if (attention >= highAttentionThreshold && lowDepth) {
      addOpportunity(
        "high_click_low_engagement",
        `近 ${safeDays} 天获得 ${attention} 次文章访问/点击，但平均阅读深度约 ${metrics.avgDepth || 0}%，互动信号偏弱。`,
        attention * 3 + (45 - Math.min(metrics.avgDepth, 45))
      );
    }

    if (highValue && metrics.clicks <= lowClickThreshold && metrics.views <= 10) {
      addOpportunity(
        "low_click_high_value",
        `文章具备推荐价值或完整基础信息，但近 ${safeDays} 天只有 ${metrics.clicks} 次点击、${metrics.views} 次阅读。`,
        120 + placementScore * 10 - metrics.clicks * 3
      );
    }

    if (staleDays >= 180 && (attention > 0 || highValue)) {
      addOpportunity(
        "stale_content",
        `距离最近更新约 ${staleDays} 天，仍有访问或处于重要内容位置，建议补充最新上下文。`,
        staleDays + attention
      );
    }

    if (seoMissing) {
      addOpportunity(
        "seo_gap",
        "中英文 SEO title 或 description 未完整填写，搜索入口和分享卡片信息不稳定。",
        80 + attention
      );
    }

    if (coverMissing) {
      addOpportunity(
        "cover_gap",
        "文章缺少受管理封面图，列表页、推荐位和社媒分享的视觉识别度不足。",
        70 + attention
      );
    }

    return rows;
  });

  const counts = Object.fromEntries(
    contentOptimizationIssueTypes.map((issueType) => [
      issueType,
      opportunities.filter((item) => item.type === issueType).length
    ])
  ) as Record<ContentOptimizationIssueType, number>;

  const filtered =
    type === "all"
      ? opportunities
      : opportunities.filter((item) => item.type === type);

  filtered.sort((left, right) => right.score - left.score);

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days: safeDays
    },
    thresholds: {
      highAttention: highAttentionThreshold,
      lowClick: lowClickThreshold
    },
    counts,
    totalPosts: postRows.length,
    opportunities: filtered.slice(0, safeLimit)
  };
}

export async function getAnalyticsOverview(filters: AnalyticsFilters) {
  const [totals] = await db
    .select({
      events: count(),
      pv: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'page_view')`,
      uv: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
      articleViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'article_view')`,
      articleClicks: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'article_click')`,
      sponsoredClicks: sql<number>`count(*) filter (where ${analyticsEvents.targetType} = 'sponsored')`,
      localeSwitches: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'locale_switch')`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters));

  const localeExpression = sql<string>`coalesce(nullif(${analyticsEvents.locale}, ''), 'unknown')`;
  const localeBreakdown = await db
    .select({
      locale: localeExpression,
      events: count(),
      pv: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'page_view')`,
      uv: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters))
    .groupBy(localeExpression)
    .orderBy(desc(sql`count(*)`));

  const categoryClicks = await db
    .select({
      categorySlug: analyticsEvents.categorySlug,
      clicks: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(
        filters,
        eq(analyticsEvents.eventName, "category_click"),
        nonEmptyCategorySlug()
      )
    )
    .groupBy(analyticsEvents.categorySlug)
    .orderBy(desc(sql`count(*)`))
    .limit(filters.limit);

  const tagClicks = await db
    .select({
      tagSlug: analyticsEvents.tagSlug,
      clicks: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(filters, eq(analyticsEvents.eventName, "tag_click"), nonEmptyTagSlug())
    )
    .groupBy(analyticsEvents.tagSlug)
    .orderBy(desc(sql`count(*)`))
    .limit(filters.limit);

  const sponsoredClicks = await db
    .select({
      href: analyticsEvents.href,
      label: analyticsEvents.label,
      path: analyticsEvents.path,
      clicks: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters, eq(analyticsEvents.targetType, "sponsored")))
    .groupBy(analyticsEvents.href, analyticsEvents.label, analyticsEvents.path)
    .orderBy(desc(sql`count(*)`))
    .limit(filters.limit);

  const localeSwitches = await db
    .select({
      locale: localeExpression,
      switches: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters, eq(analyticsEvents.eventName, "locale_switch")))
    .groupBy(localeExpression)
    .orderBy(desc(sql`count(*)`));

  return {
    range: range(filters),
    totals: {
      events: toNumber(totals?.events),
      pv: toNumber(totals?.pv),
      uv: toNumber(totals?.uv),
      sessions: toNumber(totals?.sessions),
      articleViews: toNumber(totals?.articleViews),
      articleClicks: toNumber(totals?.articleClicks),
      sponsoredClicks: toNumber(totals?.sponsoredClicks),
      localeSwitches: toNumber(totals?.localeSwitches)
    },
    localeBreakdown: localeBreakdown.map((item) => ({
      locale: item.locale,
      events: toNumber(item.events),
      pv: toNumber(item.pv),
      uv: toNumber(item.uv),
      sessions: toNumber(item.sessions)
    })),
    categoryClicks: categoryClicks.map((item) => ({
      categorySlug: item.categorySlug ?? "",
      clicks: toNumber(item.clicks),
      visitors: toNumber(item.visitors)
    })),
    tagClicks: tagClicks.map((item) => ({
      tagSlug: item.tagSlug ?? "",
      clicks: toNumber(item.clicks),
      visitors: toNumber(item.visitors)
    })),
    sponsoredClicks: sponsoredClicks.map((item) => ({
      href: item.href ?? "",
      label: item.label ?? "",
      path: item.path ?? "",
      clicks: toNumber(item.clicks),
      visitors: toNumber(item.visitors)
    })),
    localeSwitches: localeSwitches.map((item) => ({
      locale: item.locale,
      switches: toNumber(item.switches),
      visitors: toNumber(item.visitors)
    }))
  };
}

export async function getAnalyticsArticles(filters: AnalyticsFilters) {
  const articleViews = await db
    .select({
      articleSlug: analyticsEvents.articleSlug,
      views: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(
        filters,
        eq(analyticsEvents.eventName, "article_view"),
        nonEmptyArticleSlug()
      )
    )
    .groupBy(analyticsEvents.articleSlug)
    .orderBy(desc(sql`count(*)`))
    .limit(filters.limit);

  const articleClicks = await db
    .select({
      articleSlug: analyticsEvents.articleSlug,
      clicks: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(
        filters,
        eq(analyticsEvents.eventName, "article_click"),
        nonEmptyArticleSlug()
      )
    )
    .groupBy(analyticsEvents.articleSlug)
    .orderBy(desc(sql`count(*)`))
    .limit(filters.limit);

  const readingDepth = await db
    .select({
      articleSlug: analyticsEvents.articleSlug,
      value: analyticsEvents.value,
      events: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`
    })
    .from(analyticsEvents)
    .where(
      analyticsWhere(
        filters,
        eq(analyticsEvents.eventName, "article_depth"),
        nonEmptyArticleSlug(),
        sql`${analyticsEvents.value} is not null`
      )
    )
    .groupBy(analyticsEvents.articleSlug, analyticsEvents.value)
    .orderBy(asc(analyticsEvents.articleSlug), asc(analyticsEvents.value))
    .limit(filters.limit);

  return {
    range: range(filters),
    articleViews: articleViews.map((item) => ({
      articleSlug: item.articleSlug ?? "",
      views: toNumber(item.views),
      visitors: toNumber(item.visitors),
      sessions: toNumber(item.sessions)
    })),
    articleClicks: articleClicks.map((item) => ({
      articleSlug: item.articleSlug ?? "",
      clicks: toNumber(item.clicks),
      visitors: toNumber(item.visitors),
      sessions: toNumber(item.sessions)
    })),
    readingDepth: readingDepth.map((item) => ({
      articleSlug: item.articleSlug ?? "",
      value: item.value ?? 0,
      events: toNumber(item.events),
      visitors: toNumber(item.visitors)
    }))
  };
}

export async function getAnalyticsReferrers(filters: AnalyticsFilters) {
  const referrerExpression = sql<string>`coalesce(nullif(${analyticsEvents.referrer}, ''), 'direct')`;
  const referrers = await db
    .select({
      referrer: referrerExpression,
      events: count(),
      pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'page_view')`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters))
    .groupBy(referrerExpression)
    .orderBy(
      desc(sql`count(*) filter (where ${analyticsEvents.eventName} = 'page_view')`),
      desc(sql`count(*)`)
    )
    .limit(filters.limit);

  return {
    range: range(filters),
    referrers: referrers.map((item) => ({
      referrer: item.referrer,
      events: toNumber(item.events),
      pageViews: toNumber(item.pageViews),
      visitors: toNumber(item.visitors),
      sessions: toNumber(item.sessions)
    }))
  };
}

export async function getAnalyticsEvents(filters: AnalyticsFilters) {
  const [total] = await db
    .select({ total: count() })
    .from(analyticsEvents)
    .where(analyticsWhere(filters));

  const eventCounts = await db
    .select({
      eventName: analyticsEvents.eventName,
      events: count(),
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters))
    .groupBy(analyticsEvents.eventName)
    .orderBy(desc(sql`count(*)`));

  const rows = await db
    .select({
      id: analyticsEvents.id,
      eventName: analyticsEvents.eventName,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      locale: analyticsEvents.locale,
      path: analyticsEvents.path,
      referrer: analyticsEvents.referrer,
      href: analyticsEvents.href,
      label: analyticsEvents.label,
      targetType: analyticsEvents.targetType,
      section: analyticsEvents.section,
      articleSlug: analyticsEvents.articleSlug,
      categorySlug: analyticsEvents.categorySlug,
      tagSlug: analyticsEvents.tagSlug,
      value: analyticsEvents.value,
      payload: analyticsEvents.payload,
      createdAt: analyticsEvents.createdAt
    })
    .from(analyticsEvents)
    .where(analyticsWhere(filters))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(filters.limit)
    .offset(filters.offset);

  return {
    range: range(filters),
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      total: toNumber(total?.total)
    },
    eventCounts: eventCounts.map((item) => ({
      eventName: item.eventName,
      events: toNumber(item.events),
      visitors: toNumber(item.visitors),
      sessions: toNumber(item.sessions)
    })),
    events: rows.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    }))
  };
}
