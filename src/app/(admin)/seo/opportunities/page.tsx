import Link from "next/link";
import { BarChart3, Search } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { formatDate } from "@/lib/utils";
import {
  contentOptimizationIssueTypes,
  getContentOptimizationOpportunities,
  type ContentOptimizationIssueType
} from "@/server/analytics/queries";
import { requireContentEditor } from "@/server/auth/session";

const issueOptions: Array<{
  value: ContentOptimizationIssueType | "all";
  label: string;
}> = [
  { value: "all", label: "全部建议" },
  { value: "high_click_low_engagement", label: "高点击低停留" },
  { value: "low_click_high_value", label: "低点击高价值" },
  { value: "stale_content", label: "过期内容" },
  { value: "seo_gap", label: "SEO 缺口" },
  { value: "cover_gap", label: "封面缺口" }
];

function parseDays(value: string | undefined) {
  const parsed = Number(value ?? "30");
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.round(parsed), 7), 365);
}

function parseType(value: string | undefined) {
  if (value && contentOptimizationIssueTypes.includes(value as ContentOptimizationIssueType)) {
    return value as ContentOptimizationIssueType;
  }

  return "all";
}

function filterHref(params: {
  days: number;
  type: ContentOptimizationIssueType | "all";
}) {
  const query = new URLSearchParams();
  if (params.days !== 30) query.set("days", String(params.days));
  if (params.type !== "all") query.set("type", params.type);
  return `/seo/opportunities${query.toString() ? `?${query.toString()}` : ""}`;
}

function metricText(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export default async function SeoOpportunitiesPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string; type?: string }>;
}) {
  await requireContentEditor();

  const params = await searchParams;
  const days = parseDays(params.days);
  const type = parseType(params.type);
  const report = await getContentOptimizationOpportunities({
    days,
    type,
    limit: 100
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                内容优化建议
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                从 analytics、展示位、SEO 和封面状态识别需要改标题、补 SEO、换封面或更新内容的文章。
              </p>
            </div>
          </div>
        </div>
        <Link href="/seo" className={buttonClassName("secondary", "shrink-0")}>
          返回 SEO 总览
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {issueOptions.slice(1).map((option) => (
          <Link
            key={option.value}
            href={filterHref({
              days,
              type: option.value as ContentOptimizationIssueType
            })}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-500">{option.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {report.counts[option.value as ContentOptimizationIssueType]}
            </p>
          </Link>
        ))}
      </section>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[180px_220px_auto]">
        <select name="days" defaultValue={days} className={inputClassName}>
          <option value="7">近 7 天</option>
          <option value="30">近 30 天</option>
          <option value="90">近 90 天</option>
          <option value="180">近 180 天</option>
          <option value="365">近 365 天</option>
        </select>
        <select name="type" defaultValue={type} className={inputClassName}>
          {issueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClassName("secondary")}>
          <Search size={16} />
          筛选
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          统计窗口：{formatDate(report.range.from)} 至 {formatDate(report.range.to)}。
          已分析 {report.totalPosts} 篇已发布文章，当前筛选显示 {report.opportunities.length} 条建议。
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[300px]" />
              <col className="w-[150px]" />
              <col className="w-[210px]" />
              <col className="w-[220px]" />
              <col className="w-[280px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">文章</th>
                <th className="px-4 py-3 font-medium">建议类型</th>
                <th className="px-4 py-3 font-medium">近 {report.range.days} 天指标</th>
                <th className="px-4 py-3 font-medium">内容状态</th>
                <th className="px-4 py-3 font-medium">原因与建议</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.opportunities.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link
                      href={`/posts/${item.post.id}/edit`}
                      className="font-medium text-slate-950 hover:text-slate-700 hover:underline"
                    >
                      {item.post.title}
                    </Link>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {item.post.slug}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.post.categoryName}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      {item.typeLabel}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      优先分 {Math.round(item.score)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-6 text-slate-600">
                    <p>阅读：{metricText(item.metrics.views)}</p>
                    <p>点击：{metricText(item.metrics.clicks)}</p>
                    <p>访客：{metricText(item.metrics.visitors)}</p>
                    <p>平均深度：{item.metrics.avgDepth || 0}%</p>
                    <p>外链点击：{metricText(item.metrics.outboundClicks)}</p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-6 text-slate-600">
                    <p>SEO：{item.post.seoComplete ? "完整" : "需补全"}</p>
                    <p>封面：{item.post.hasCover ? "已有" : "缺失"}</p>
                    <p>首页置顶：{item.post.pinned ? "是" : "否"}</p>
                    <p>特色：{item.post.featured || item.post.mark ? "是" : "否"}</p>
                    <p>展示位分：{item.post.placementScore}</p>
                    <p>更新：{formatDate(item.post.updatedAt)}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p className="leading-6">{item.reason}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {item.actionLabel}
                    </p>
                    <p className="mt-1 leading-6">{item.recommendation}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid justify-items-start gap-2">
                      <Link
                        href={`/posts/${item.post.id}/edit`}
                        className={buttonClassName("secondary", "min-h-8 px-2")}
                      >
                        编辑文章
                      </Link>
                      <Link
                        href={`/seo?q=${encodeURIComponent(item.post.slug)}`}
                        className={buttonClassName("ghost", "min-h-8 px-2")}
                      >
                        查看 SEO
                      </Link>
                      <Link
                        href="/media/covers"
                        className={buttonClassName("ghost", "min-h-8 px-2")}
                      >
                        生成封面
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {report.opportunities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    当前筛选下暂无内容优化建议。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
