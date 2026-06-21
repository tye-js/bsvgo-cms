import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  ImagePlus,
  Loader2,
  SearchCheck,
  Sparkles,
  XCircle
} from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { DetailDrawer, FilterBar, InfoList, WideTable } from "@/components/admin/DataLayout";
import { MetricStrip, MetricTile, PageHeader } from "@/components/admin/PageHeader";
import { AiJobRetryButton } from "@/components/forms/AiJobRetryButton";
import {
  aiJobStatusClassName,
  aiJobStatusLabel,
  aiJobTypeLabel
} from "@/lib/ai-jobs";
import { formatDate } from "@/lib/utils";
import {
  aiJobStatusValues,
  aiJobTypeValues,
  cleanupExpiredAiJobsIfDue,
  listAiJobCreatorsForUser,
  listAiJobsForUser
} from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";
import type { AiJobStatus, AiJobType } from "@/server/db/schema";
import { getAiJobSettings } from "@/server/settings/service";

type DraftStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

type DraftStep = {
  key: string;
  label: string;
  status: DraftStepStatus;
  message?: string;
};

const draftStepOrder = [
  { key: "source", label: "素材" },
  { key: "chinese", label: "中文稿" },
  { key: "english", label: "英文稿" },
  { key: "metadata", label: "SEO" },
  { key: "database", label: "草稿" },
  { key: "cover", label: "封面" }
];

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function percent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function normalizeDraftSteps(output: Record<string, unknown> | null): DraftStep[] {
  const storedSteps = Array.isArray(output?.steps) ? output.steps : [];

  return draftStepOrder.map((definition) => {
    const stored = storedSteps
      .map((step) => toRecord(step))
      .find((step) => step.key === definition.key);
    const rawStatus = stored?.status;
    const status =
      rawStatus === "running" ||
      rawStatus === "succeeded" ||
      rawStatus === "failed" ||
      rawStatus === "skipped"
        ? rawStatus
        : "pending";

    return {
      ...definition,
      status,
      message: typeof stored?.message === "string" ? stored.message : undefined
    };
  });
}

function progressFromDraftSteps(steps: DraftStep[]) {
  const done = steps.filter(
    (step) => step.status === "succeeded" || step.status === "skipped"
  ).length;
  return percent((done / steps.length) * 100);
}

function progressFromBulkOutput(output: Record<string, unknown> | null) {
  const total = Number(output?.total ?? 0);
  const processed = Number(output?.processed ?? output?.generated ?? output?.updated ?? 0);
  return total > 0 ? percent((processed / total) * 100) : 0;
}

function titleFromJob(job: {
  type: AiJobType;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  relatedPostTitle: string;
}) {
  if (job.relatedPostTitle) return job.relatedPostTitle;

  const input = toRecord(job.input);
  const output = toRecord(job.output);
  const zh = toRecord(output.zh);
  const en = toRecord(output.en);

  return (
    [
      zh.title,
      en.title,
      input.zhTitle,
      input.title,
      input.sourceTitle
    ].find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    ) ?? aiJobTypeLabel(job.type)
  );
}

function outputSummary(output: Record<string, unknown> | null) {
  if (!output) return "暂无输出";
  const message = output.message;
  if (typeof message === "string" && message.trim()) return message;

  const total = Number(output.total ?? 0);
  const processed = Number(output.processed ?? 0);
  const updated = Number(output.updated ?? output.generated ?? 0);
  const skipped = Number(output.skipped ?? 0);
  const failed = Number(output.failed ?? 0);
  if (total > 0) {
    return `已处理 ${processed}/${total}，已更新 ${updated}${skipped ? `，跳过 ${skipped}` : ""}${failed ? `，失败 ${failed}` : ""}`;
  }

  const postEditUrl = output.postEditUrl;
  if (typeof postEditUrl === "string" && postEditUrl) return "文章草稿已创建";

  return "查看详情";
}

function draftStepIcon(status: DraftStepStatus) {
  if (status === "succeeded" || status === "skipped") {
    return <CheckCircle2 size={14} className="text-emerald-600" />;
  }
  if (status === "running") {
    return <Loader2 size={14} className="animate-spin text-slate-600" />;
  }
  if (status === "failed") {
    return <XCircle size={14} className="text-rose-600" />;
  }
  return <Circle size={14} className="text-slate-300" />;
}

function JobProgress({
  type,
  status,
  output
}: {
  type: AiJobType;
  status: AiJobStatus;
  output: Record<string, unknown> | null;
}) {
  if (type === "post_draft_create") {
    const steps = normalizeDraftSteps(output);
    const progress = progressFromDraftSteps(steps);

    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{progress}%</span>
          <span>{aiJobStatusLabel(status)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex min-w-0 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1"
              title={step.message ?? step.label}
            >
              {draftStepIcon(step.status)}
              <span className="truncate text-xs text-slate-600">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (
    type === "bulk_post_cover_images" ||
    type === "bulk_media_metadata" ||
    type === "bulk_post_seo"
  ) {
    const progress = progressFromBulkOutput(output);
    const total = Number(output?.total ?? 0);
    const processed = Number(output?.processed ?? output?.generated ?? output?.updated ?? 0);
    const generated = Number(output?.generated ?? output?.updated ?? 0);
    const skipped = Number(output?.skipped ?? 0);

    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{progress}%</span>
          <span>
            已处理 {processed}/{total || "-"} · 产出 {generated}
            {skipped ? ` · 跳过 ${skipped}` : ""}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-700" style={{ width: `${progress}%` }} />
        </div>
        {output?.currentTitle || output?.currentLabel ? (
          <p className="line-clamp-1 text-xs text-slate-500">
            当前：{String(output.currentTitle ?? output.currentLabel)}
          </p>
        ) : null}
      </div>
    );
  }

  return <p className="line-clamp-3 leading-6 text-slate-600">{outputSummary(output)}</p>;
}

export default async function AiJobsPage({
  searchParams
}: {
 searchParams: Promise<{
    type?: string;
    status?: string;
    creator?: string;
    q?: string;
    range?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireContentEditor();
  const [settings] = await Promise.all([
    getAiJobSettings(),
    cleanupExpiredAiJobsIfDue()
  ]);
  const type = aiJobTypeValues.includes(params.type as AiJobType)
    ? (params.type as AiJobType)
    : "all";
  const status = aiJobStatusValues.includes(params.status as AiJobStatus)
    ? (params.status as AiJobStatus)
    : "all";
  const rawCreatorId = user.role === "admin" && params.creator ? params.creator : "all";
  const query = (params.q ?? "").trim();
  const range = params.range === "all" ? "all" : "recent";
  const createdAfter =
    range === "recent"
      ? new Date(Date.now() - settings.defaultRecentDays * 24 * 60 * 60 * 1000)
      : undefined;
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const creators = await listAiJobCreatorsForUser(user);
  const creatorId =
    rawCreatorId !== "all" && creators.some((creator) => creator.id === rawCreatorId)
      ? rawCreatorId
      : "all";
  const { rows, total, pageSize } = await listAiJobsForUser({
    user,
    type,
    status,
    query,
    creatorId,
    createdAfter,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const activeCount = rows.filter((job) =>
    ["queued", "running"].includes(job.status)
  ).length;
  const failedCount = rows.filter((job) => job.status === "failed").length;
  const selectedJob = rows[0] ?? null;

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (type !== "all") search.set("type", type);
    if (status !== "all") search.set("status", status);
    if (user.role === "admin" && creatorId !== "all") search.set("creator", creatorId);
    if (query) search.set("q", query);
    if (range !== "recent") search.set("range", range);
    search.set("page", String(nextPage));
    return `/ai/jobs?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="AI 任务中心"
        description="统一查看文章改写、SEO、媒体 SEO、封面生成等后台 AI 任务，失败任务可继续生成。"
        icon={<Sparkles size={20} />}
        actions={
          <>
          <Link href="/posts/new" className={buttonClassName("primary")}>
            <FileText size={16} />
            AI 改写
          </Link>
          <Link href="/media/covers" className={buttonClassName("secondary")}>
            <ImagePlus size={16} />
            封面生成
          </Link>
          </>
        }
        metrics={
          <MetricStrip>
            <MetricTile
              label="筛选结果"
              value={total}
              note={
                range === "recent"
                  ? `最近 ${settings.defaultRecentDays} 天 + 进行中`
                  : "全部历史"
              }
            />
            <MetricTile
              label="当前页进行中"
              value={activeCount}
              note="排队或运行"
              tone="active"
            />
            <MetricTile
              label="当前页失败"
              value={failedCount}
              note="可在列表直接重试"
              tone="warning"
            />
            <MetricTile
              label="当前页任务"
              value={rows.length}
              note="列表密度优化"
            />
          </MetricStrip>
        }
      />

      <FilterBar className="grid gap-3 lg:grid-cols-[180px_150px_170px_220px_minmax(0,1fr)_auto]">
        <select
          name="type"
          defaultValue={type}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">全部任务类型</option>
          {aiJobTypeValues.map((value) => (
            <option key={value} value={value}>
              {aiJobTypeLabel(value)}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">全部状态</option>
          {aiJobStatusValues.map((value) => (
            <option key={value} value={value}>
              {aiJobStatusLabel(value)}
            </option>
          ))}
        </select>
        <select
          name="range"
          defaultValue={range}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="recent">最近 {settings.defaultRecentDays} 天 + 进行中</option>
          <option value="all">全部历史</option>
        </select>
        {user.role === "admin" ? (
          <select
            name="creator"
            defaultValue={creatorId}
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="all">全部创建人</option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.name || creator.email}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="creator" value="all" />
        )}
        <input
          name="q"
          defaultValue={query}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="搜索文章标题、文章 ID、任务 ID、错误信息"
        />
        <input type="hidden" name="page" value="1" />
        <button className={buttonClassName("secondary")} type="submit">
          <SearchCheck size={16} />
          筛选
        </button>
      </FilterBar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <WideTable
            minWidth="1280px"
            footer={
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  第 {page} / {pageCount} 页，共 {total} 条
                </span>
                <div className="flex gap-2">
                  <Link
                    className={buttonClassName(
                      "secondary",
                      page <= 1 ? "pointer-events-none opacity-50" : ""
                    )}
                    href={preserveParams(Math.max(page - 1, 1))}
                  >
                    上一页
                  </Link>
                  <Link
                    className={buttonClassName(
                      "secondary",
                      page >= pageCount ? "pointer-events-none opacity-50" : ""
                    )}
                    href={preserveParams(Math.min(page + 1, pageCount))}
                  >
                    下一页
                  </Link>
                </div>
              </div>
            }
          >
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[150px]" />
              <col className="w-[420px]" />
              <col className="w-[170px]" />
              <col className="w-[210px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">任务 / 文章</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">进度与摘要</th>
                <th className="px-4 py-3 font-medium">创建人</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((job) => {
                const postEditUrl =
                  typeof job.output?.postEditUrl === "string"
                    ? job.output.postEditUrl
                    : "";
                const firstPostId = job.relatedPostIds[0] ?? "";

                return (
                  <tr key={job.id} className="align-top">
                    <td className="px-4 py-4">
                      <Link
                        href={`/ai/jobs/${job.id}`}
                        className="font-medium text-slate-950 hover:text-slate-700 hover:underline"
                      >
                        {titleFromJob(job)}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {aiJobTypeLabel(job.type)} · 第 {job.attempts} 次执行
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">{job.id}</p>
                      {firstPostId ? (
                        <p className="mt-2 text-xs text-slate-500">
                          关联文章：
                          <Link
                            href={`/posts/${firstPostId}/edit`}
                            className="font-medium text-slate-700 hover:underline"
                          >
                            {firstPostId}
                          </Link>
                          {job.relatedPostIds.length > 1
                            ? ` 等 ${job.relatedPostIds.length} 篇`
                            : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${aiJobStatusClassName(job.status)}`}
                      >
                        {job.status === "running" ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : job.status === "queued" ? (
                          <Clock3 size={13} />
                        ) : null}
                        {aiJobStatusLabel(job.status)}
                      </span>
                      {job.error ? (
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-rose-600">
                          {job.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <JobProgress type={job.type} status={job.status} output={job.output} />
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {outputSummary(job.output)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                      <p className="font-medium text-slate-700">
                        {job.creatorName || "未知"}
                      </p>
                      <p className="break-all">{job.creatorEmail || "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                      <p>创建：{formatDate(job.createdAt)}</p>
                      <p>开始：{formatDate(job.startedAt)}</p>
                      <p>完成：{formatDate(job.finishedAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid justify-items-start gap-2">
                        {postEditUrl ? (
                          <Link
                            href={postEditUrl}
                            className={buttonClassName("secondary", "min-h-8 px-2")}
                          >
                            打开草稿
                          </Link>
                        ) : null}
                        <Link
                          href={`/ai/jobs/${job.id}`}
                          className={buttonClassName("secondary", "min-h-8 px-2")}
                        >
                          查看详情
                        </Link>
                        {job.status === "failed" ? (
                          <AiJobRetryButton jobId={job.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    {range === "recent"
                      ? `最近 ${settings.defaultRecentDays} 天没有已创建任务，也没有进行中任务。可切换到全部历史查看未清理记录。`
                      : "暂无 AI 任务。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </WideTable>
        </div>

        <DetailDrawer
          title="当前任务摘要"
          description="默认展示当前筛选结果第一条任务，详情页可查看完整输入输出。"
          actions={
            selectedJob ? (
              <Link
                href={`/ai/jobs/${selectedJob.id}`}
                className={buttonClassName("secondary", "min-h-9")}
              >
                打开详情
              </Link>
            ) : null
          }
        >
          {selectedJob ? (
            <>
              <InfoList
                items={[
                  { label: "任务类型", value: aiJobTypeLabel(selectedJob.type) },
                  { label: "状态", value: aiJobStatusLabel(selectedJob.status) },
                  { label: "文章", value: titleFromJob(selectedJob) },
                  {
                    label: "创建人",
                    value: selectedJob.creatorName || selectedJob.creatorEmail || "未知"
                  },
                  { label: "创建时间", value: formatDate(selectedJob.createdAt) }
                ]}
              />
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <JobProgress
                  type={selectedJob.type}
                  status={selectedJob.status}
                  output={selectedJob.output}
                />
              </div>
              {selectedJob.error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700">
                  {selectedJob.error}
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  {outputSummary(selectedJob.output)}
                </p>
              )}
              {selectedJob.status === "failed" ? (
                <AiJobRetryButton jobId={selectedJob.id} />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">当前筛选下暂无任务。</p>
          )}
        </DetailDrawer>
      </div>
    </div>
  );
}
