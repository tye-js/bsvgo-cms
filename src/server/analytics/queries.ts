import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lt,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "@/server/db";
import {
  analyticsEvents,
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
