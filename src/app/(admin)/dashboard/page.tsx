import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MousePointerClick,
  PenLine,
  SearchCheck,
  Sparkles,
  WandSparkles
} from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { PageHeader } from "@/components/admin/PageHeader";
import { AiJobRetryButton } from "@/components/forms/AiJobRetryButton";
import {
  aiJobStatusClassName,
  aiJobStatusLabel,
  aiJobTypeLabel
} from "@/lib/ai-jobs";
import { cn, formatDate } from "@/lib/utils";
import {
  getAnalyticsArticles,
  getAnalyticsOverview,
  getContentOptimizationOpportunities,
  type AnalyticsFilters
} from "@/server/analytics/queries";
import { listAiJobsForUser } from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";
import { getDashboardStats } from "@/server/content/queries";

const periodOptions = [
  { label: "近 7 天", days: 7 },
  { label: "近 30 天", days: 30 },
  { label: "近 90 天", days: 90 }
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

function dashboardHref(days: number) {
  return `/dashboard?days=${days}`;
}

function buildAnalyticsFilters(days: number): AnalyticsFilters {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    from,
    to,
    limit: 50,
    offset: 0
  };
}

function outputSummary(output: Record<string, unknown> | null) {
  if (!output) return "暂无输出";
  const message = output.message;
  if (typeof message === "string" && message.trim()) return message;

  const total = Number(output.total ?? 0);
  const processed = Number(output.processed ?? 0);
  const updated = Number(output.updated ?? output.generated ?? 0);
  const failed = Number(output.failed ?? 0);
  if (total > 0) {
    return `已处理 ${processed}/${total}，已更新 ${updated}${failed ? `，失败 ${failed}` : ""}`;
  }

  if (typeof output.postEditUrl === "string" && output.postEditUrl) {
    return "文章草稿已创建";
  }

  return "查看任务详情";
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{label}</div>;
}

function SectionCard({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon: Icon
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-950">{title}</p>
            <ArrowRight
              size={14}
              className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
            />
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function SignalCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "neutral" | "active" | "warning" | "success";
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    active: "bg-sky-50 text-sky-700",
    warning: "bg-rose-50 text-rose-700",
    success: "bg-emerald-50 text-emerald-700"
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneClass)}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireContentEditor();
  const params = await searchParams;
  const selectedDays = parseDays(params.days);
  const analyticsFilters = buildAnalyticsFilters(selectedDays);

  const [
    stats,
    overview,
    articles,
    recentJobs,
    failedJobs,
    runningJobs,
    queuedJobs,
    opportunities
  ] = await Promise.all([
    getDashboardStats(),
    getAnalyticsOverview(analyticsFilters),
    getAnalyticsArticles(analyticsFilters),
    listAiJobsForUser({ user, page: 1, pageSize: 8 }),
    listAiJobsForUser({ user, status: "failed", page: 1, pageSize: 4 }),
    listAiJobsForUser({ user, status: "running", page: 1, pageSize: 1 }),
    listAiJobsForUser({ user, status: "queued", page: 1, pageSize: 1 }),
    getContentOptimizationOpportunities({ days: selectedDays, limit: 6 })
  ]);

  const activeJobs = runningJobs.total + queuedJobs.total;
  const failedJobCount = failedJobs.total;
  const topOpportunity = opportunities.opportunities[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="AI 工作台"
        description="优先处理 AI 改写、SEO、媒体补全、封面生成和内容优化任务。"
        icon={<Sparkles size={20} />}
        actions={
          <>
          {periodOptions.map((option) => (
            <Link
              key={option.days}
              href={dashboardHref(option.days)}
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
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <QuickAction
          href="/posts/new"
          title="AI 改写成文"
          description="粘贴素材或导入 Markdown，后台生成中英文草稿。"
          icon={WandSparkles}
        />
        <QuickAction
          href="/ai/jobs"
          title="AI 任务中心"
          description="查看所有生成任务、失败原因、输入输出和重试。"
          icon={ListChecks}
        />
        <QuickAction
          href="/seo/opportunities"
          title="内容优化建议"
          description="按 analytics 找到需要改标题、补 SEO、换封面的文章。"
          icon={SearchCheck}
        />
        <QuickAction
          href="/media/covers"
          title="文章封面生成"
          description="批量为文章生成封面和双语图片 SEO 信息。"
          icon={ImagePlus}
        />
        <QuickAction
          href="/collections"
          title="专题辑运营"
          description="维护专题文章顺序，让系列内容按策划逻辑呈现。"
          icon={LayoutDashboard}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          label="AI 进行中"
          value={formatNumber(activeJobs)}
          note={`${formatNumber(runningJobs.total)} 运行中 / ${formatNumber(queuedJobs.total)} 排队中`}
          icon={Loader2}
          tone="active"
        />
        <SignalCard
          label="AI 失败任务"
          value={formatNumber(failedJobCount)}
          note={failedJobCount ? "优先查看并继续生成" : "暂无需要处理的失败任务"}
          icon={AlertTriangle}
          tone={failedJobCount ? "warning" : "success"}
        />
        <SignalCard
          label="草稿箱"
          value={formatNumber(stats.drafts)}
          note="AI 成文后默认进入草稿"
          icon={FileText}
        />
        <SignalCard
          label="内容优化建议"
          value={formatNumber(opportunities.opportunities.length)}
          note={
            topOpportunity
              ? `${topOpportunity.typeLabel}：${topOpportunity.post.title}`
              : "当前筛选下暂无建议"
          }
          icon={PenLine}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <SectionCard
          title="最近 AI 任务"
          description="任务创建后会在后台继续执行，失败任务可从这里继续生成。"
          action={
            <Link href="/ai/jobs" className={buttonClassName("secondary", "min-h-8 px-2")}>
              查看全部
            </Link>
          }
        >
          {recentJobs.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">任务</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">摘要</th>
                    <th className="px-5 py-3 font-medium">时间</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentJobs.rows.map((job) => (
                    <tr key={job.id} className="align-top">
                      <td className="px-5 py-4">
                        <Link
                          href={`/ai/jobs/${job.id}`}
                          className="font-medium text-slate-950 hover:text-slate-700 hover:underline"
                        >
                          {aiJobTypeLabel(job.type)}
                        </Link>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {job.id}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
                            aiJobStatusClassName(job.status)
                          )}
                        >
                          {job.status === "running" ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : job.status === "queued" ? (
                            <Clock3 size={13} />
                          ) : job.status === "succeeded" ? (
                            <CheckCircle2 size={13} />
                          ) : null}
                          {aiJobStatusLabel(job.status)}
                        </span>
                        {job.error ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-rose-600">
                            {job.error}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="line-clamp-3 leading-6">
                          {outputSummary(job.output)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs leading-5 text-slate-500">
                        <p>创建：{formatDate(job.createdAt)}</p>
                        <p>完成：{formatDate(job.finishedAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid justify-items-start gap-2">
                          <Link
                            href={`/ai/jobs/${job.id}`}
                            className={buttonClassName("secondary", "min-h-8 px-2")}
                          >
                            详情
                          </Link>
                          {job.status === "failed" ? (
                            <AiJobRetryButton jobId={job.id} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="暂无 AI 任务。" />
          )}
        </SectionCard>

        <SectionCard
          title="待处理"
          description="优先处理会阻塞内容生产的事项。"
          action={
            failedJobCount ? (
              <Link
                href="/ai/jobs?status=failed"
                className={buttonClassName("secondary", "min-h-8 px-2")}
              >
                查看失败
              </Link>
            ) : null
          }
        >
          <div className="divide-y divide-slate-100">
            {failedJobs.rows.slice(0, 3).map((job) => (
              <div key={job.id} className="grid gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-950">
                    {aiJobTypeLabel(job.type)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-rose-600">
                    {job.error || "任务失败，可继续生成。"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AiJobRetryButton jobId={job.id} />
                  <Link
                    href={`/ai/jobs/${job.id}`}
                    className={buttonClassName("ghost", "min-h-8 px-2")}
                  >
                    查看输入输出
                  </Link>
                </div>
              </div>
            ))}
            {failedJobs.rows.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate-500">
                暂无失败任务。继续关注草稿箱和内容优化建议。
              </div>
            ) : null}
            <div className="grid gap-3 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">草稿待审</span>
                <span className="text-slate-500">{formatNumber(stats.drafts)} 篇</span>
              </div>
              <Link href="/posts/drafts" className={buttonClassName("secondary", "min-h-8 px-2 justify-self-start")}>
                打开草稿箱
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard
          title="AI 内容优化队列"
          description={`基于近 ${selectedDays} 天 analytics、SEO 和封面状态生成。`}
          action={
            <Link
              href={`/seo/opportunities?days=${selectedDays}`}
              className={buttonClassName("secondary", "min-h-8 px-2")}
            >
              查看全部
            </Link>
          }
        >
          {opportunities.opportunities.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">文章</th>
                    <th className="px-5 py-3 font-medium">建议</th>
                    <th className="px-5 py-3 font-medium">信号</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.opportunities.slice(0, 6).map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-950">
                          {item.post.title}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {item.post.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                          {item.typeLabel}
                        </span>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.actionLabel}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs leading-6 text-slate-500">
                        <p>阅读：{formatNumber(item.metrics.views)}</p>
                        <p>点击：{formatNumber(item.metrics.clicks)}</p>
                        <p>深度：{item.metrics.avgDepth || 0}%</p>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/posts/${item.post.id}/edit`}
                          className={buttonClassName("secondary", "min-h-8 px-2")}
                        >
                          处理
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="当前没有内容优化建议。" />
          )}
        </SectionCard>

        <SectionCard
          title="内容与流量信号"
          description="辅助判断 AI 生产后的发布和推广效果。"
        >
          <div className="grid gap-3 p-4">
            <SignalCard
              label="已发布文章"
              value={formatNumber(stats.published)}
              note={`总文章 ${formatNumber(stats.posts)} 篇`}
              icon={FileText}
              tone="success"
            />
            <SignalCard
              label="文章阅读"
              value={formatCompactNumber(overview.totals.articleViews)}
              note={`近 ${selectedDays} 天 article_view`}
              icon={BarChart3}
            />
            <SignalCard
              label="文章点击"
              value={formatCompactNumber(overview.totals.articleClicks)}
              note={`近 ${selectedDays} 天 article_click`}
              icon={MousePointerClick}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="热门文章信号"
        description="保留核心阅读/点击榜，用于判断哪些文章值得二次 AI 优化。"
      >
        <div className="grid gap-0 xl:grid-cols-2">
          <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-700">
              阅读最多
            </div>
            {articles.articleViews.length ? (
              <div className="divide-y divide-slate-100">
                {articles.articleViews.slice(0, 6).map((item) => (
                  <div
                    key={item.articleSlug}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                  >
                    <span className="truncate font-medium text-slate-900">
                      {item.articleSlug}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {formatNumber(item.views)} 阅读
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="暂无阅读数据。" />
            )}
          </div>
          <div>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-700">
              点击最多
            </div>
            {articles.articleClicks.length ? (
              <div className="divide-y divide-slate-100">
                {articles.articleClicks.slice(0, 6).map((item) => (
                  <div
                    key={item.articleSlug}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                  >
                    <span className="truncate font-medium text-slate-900">
                      {item.articleSlug}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {formatNumber(item.clicks)} 点击
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="暂无点击数据。" />
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
