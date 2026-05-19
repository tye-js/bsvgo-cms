import Link from "next/link";
import {
  BarChart3,
  Clock,
  Eye,
  FileText,
  FolderTree,
  Languages,
  Megaphone,
  MousePointerClick,
  Tags,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getAnalyticsArticles,
  getAnalyticsOverview,
  getAnalyticsReferrers,
  type AnalyticsFilters
} from "@/server/analytics/queries";
import { getDashboardStats } from "@/server/content/queries";

const statCards = [
  { label: "文章总数", key: "posts", icon: FileText },
  { label: "已发布", key: "published", icon: Clock },
  { label: "草稿", key: "drafts", icon: FileText },
  { label: "分类", key: "categories", icon: FolderTree },
  { label: "标签", key: "tags", icon: Tags }
] as const;

const periodOptions = [
  { label: "近 7 天", days: 7 },
  { label: "近 30 天", days: 30 },
  { label: "近 90 天", days: 90 }
] as const;

const localeOptions = [
  { label: "全部语言", locale: undefined },
  { label: "中文", locale: "zh" },
  { label: "英文", locale: "en" }
] as const;

const numberFormatter = new Intl.NumberFormat("zh-CN");
const compactNumberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
}

function parseDays(value?: string) {
  const parsed = Number(value);
  return periodOptions.some((option) => option.days === parsed) ? parsed : 30;
}

function parseLocale(value?: string) {
  return value === "en" || value === "zh" ? value : undefined;
}

function dashboardHref({
  days,
  locale
}: {
  days: number;
  locale?: "en" | "zh";
}) {
  const params = new URLSearchParams({ days: String(days) });
  if (locale) params.set("locale", locale);
  return `/dashboard?${params.toString()}`;
}

function buildAnalyticsFilters(days: number, locale?: "en" | "zh"): AnalyticsFilters {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    from,
    to,
    locale,
    limit: 50,
    offset: 0
  };
}

function StatCard({
  label,
  value,
  note,
  icon: Icon
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon size={18} className="text-slate-500" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-950">
        {formatCompactNumber(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{label}</div>;
}

function localeLabel(locale: string) {
  const labels: Record<string, string> = {
    zh: "中文",
    en: "英文",
    unknown: "未知"
  };

  return labels[locale] ?? locale;
}

function cleanReferrer(referrer: string) {
  if (referrer === "direct") return "直接访问";

  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return referrer;
  }
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string; locale?: string }>;
}) {
  const params = await searchParams;
  const selectedDays = parseDays(params.days);
  const selectedLocale = parseLocale(params.locale);
  const analyticsFilters = buildAnalyticsFilters(selectedDays, selectedLocale);

  const [stats, overview, articles, referrers] = await Promise.all([
    getDashboardStats(),
    getAnalyticsOverview(analyticsFilters),
    getAnalyticsArticles(analyticsFilters),
    getAnalyticsReferrers(analyticsFilters)
  ]);

  const trafficCards = [
    {
      label: "PV",
      value: overview.totals.pv,
      note: "event_name = page_view",
      icon: Eye
    },
    {
      label: "UV",
      value: overview.totals.uv,
      note: "count(distinct visitor_id)",
      icon: Users
    },
    {
      label: "会话数",
      value: overview.totals.sessions,
      note: "count(distinct session_id)",
      icon: BarChart3
    },
    {
      label: "文章阅读",
      value: overview.totals.articleViews,
      note: "article_view",
      icon: FileText
    },
    {
      label: "文章点击",
      value: overview.totals.articleClicks,
      note: "article_click",
      icon: MousePointerClick
    },
    {
      label: "推广点击",
      value: overview.totals.sponsoredClicks,
      note: "target_type = sponsored",
      icon: Megaphone
    },
    {
      label: "语言切换",
      value: overview.totals.localeSwitches,
      note: "locale_switch",
      icon: Languages
    }
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            概览
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            查看发布状态、核心流量指标和最近编辑动态。
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <Icon size={18} className="text-slate-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {stats[card.key]}
              </p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">流量统计</h2>
            <p className="mt-1 text-sm text-slate-500">
              默认按最近 {selectedDays} 天统计
              {selectedLocale ? `，当前语言：${localeLabel(selectedLocale)}` : "，当前语言：全部"}。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Link
                key={option.days}
                href={dashboardHref({ days: option.days, locale: selectedLocale })}
                className={cn(
                  "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition",
                  selectedDays === option.days
                    ? "border-slate-900 bg-slate-900 !text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </Link>
            ))}
            {localeOptions.map((option) => (
              <Link
                key={option.locale ?? "all"}
                href={dashboardHref({ days: selectedDays, locale: option.locale })}
                className={cn(
                  "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition",
                  selectedLocale === option.locale
                    ? "border-slate-900 bg-slate-900 !text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {trafficCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="文章阅读"
          description="event_name = article_view，按 article_slug 汇总。"
        >
          {articles.articleViews.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Article Slug</th>
                    <th className="px-5 py-3 text-right font-medium">阅读</th>
                    <th className="px-5 py-3 text-right font-medium">访客</th>
                    <th className="px-5 py-3 text-right font-medium">会话</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articles.articleViews.slice(0, 8).map((item) => (
                    <tr key={item.articleSlug}>
                      <td className="max-w-[260px] truncate px-5 py-3 font-medium text-slate-900">
                        {item.articleSlug}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatNumber(item.views)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(item.visitors)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(item.sessions)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="暂无文章阅读数据。" />
          )}
        </SectionCard>

        <SectionCard
          title="文章点击"
          description="event_name = article_click，按 article_slug 汇总。"
        >
          {articles.articleClicks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Article Slug</th>
                    <th className="px-5 py-3 text-right font-medium">点击</th>
                    <th className="px-5 py-3 text-right font-medium">访客</th>
                    <th className="px-5 py-3 text-right font-medium">会话</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articles.articleClicks.slice(0, 8).map((item) => (
                    <tr key={item.articleSlug}>
                      <td className="max-w-[260px] truncate px-5 py-3 font-medium text-slate-900">
                        {item.articleSlug}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatNumber(item.clicks)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(item.visitors)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(item.sessions)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="暂无文章点击数据。" />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="阅读深度"
          description="article_depth，按 article_slug 和 value 汇总。"
        >
          {articles.readingDepth.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Article Slug</th>
                    <th className="px-5 py-3 text-right font-medium">深度</th>
                    <th className="px-5 py-3 text-right font-medium">次数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articles.readingDepth.slice(0, 12).map((item) => (
                    <tr key={`${item.articleSlug}-${item.value}`}>
                      <td className="max-w-[220px] truncate px-5 py-3 font-medium text-slate-900">
                        {item.articleSlug}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {item.value}%
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(item.events)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="暂无阅读深度数据。" />
          )}
        </SectionCard>

        <SectionCard
          title="分类点击"
          description="event_name = category_click，按 category_slug 汇总。"
        >
          {overview.categoryClicks.length ? (
            <div className="divide-y divide-slate-100">
              {overview.categoryClicks.slice(0, 10).map((item) => (
                <div
                  key={item.categorySlug}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="truncate font-medium text-slate-900">
                    {item.categorySlug}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {formatNumber(item.clicks)} 次
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="暂无分类点击数据。" />
          )}
        </SectionCard>

        <SectionCard
          title="标签点击"
          description="event_name = tag_click，按 tag_slug 汇总。"
        >
          {overview.tagClicks.length ? (
            <div className="divide-y divide-slate-100">
              {overview.tagClicks.slice(0, 10).map((item) => (
                <div
                  key={item.tagSlug}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="truncate font-medium text-slate-900">
                    {item.tagSlug}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {formatNumber(item.clicks)} 次
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="暂无标签点击数据。" />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="推广点击"
          description="target_type = sponsored，按链接和展示位置汇总。"
        >
          {overview.sponsoredClicks.length ? (
            <div className="divide-y divide-slate-100">
              {overview.sponsoredClicks.slice(0, 8).map((item) => (
                <div
                  key={`${item.href}-${item.path}-${item.label}`}
                  className="grid gap-1 px-5 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate font-medium text-slate-900">
                      {item.label || item.href || "未命名推广位"}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {formatNumber(item.clicks)} 次
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {item.href || item.path || "-"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="暂无推广点击数据。" />
          )}
        </SectionCard>

        <SectionCard
          title="语言切换"
          description="event_name = locale_switch，按 locale 汇总。"
        >
          {overview.localeSwitches.length ? (
            <div className="divide-y divide-slate-100">
              {overview.localeSwitches.map((item) => (
                <div
                  key={item.locale}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="font-medium text-slate-900">
                    {localeLabel(item.locale)}
                  </span>
                  <span className="text-slate-500">
                    {formatNumber(item.switches)} 次
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="暂无语言切换数据。" />
          )}
        </SectionCard>

        <SectionCard title="来源统计" description="按 referrer 汇总访问来源。">
          {referrers.referrers.length ? (
            <div className="divide-y divide-slate-100">
              {referrers.referrers.slice(0, 10).map((item) => (
                <div
                  key={item.referrer}
                  className="grid gap-1 px-5 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate font-medium text-slate-900">
                      {cleanReferrer(item.referrer)}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {formatNumber(item.pageViews)} PV
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatNumber(item.visitors)} UV / {formatNumber(item.sessions)} 会话
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="暂无来源数据。" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
