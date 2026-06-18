import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Loader2,
  XCircle
} from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { AiJobRetryButton } from "@/components/forms/AiJobRetryButton";
import { formatDate } from "@/lib/utils";
import { listRecentPostDraftJobsForUser } from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";

type DraftStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

type DraftStepKey =
  | "source"
  | "chinese"
  | "english"
  | "metadata"
  | "database"
  | "cover";

type DraftStep = {
  key: DraftStepKey;
  label: string;
  status: DraftStepStatus;
  message?: string;
};

const draftSteps: Array<{ key: DraftStepKey; label: string }> = [
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

function jobStatusLabel(status: string) {
  if (status === "queued") return "排队中";
  if (status === "running") return "生成中";
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "失败";
  return status;
}

function jobTypeLabel(type: string) {
  if (type === "post_draft_create") return "AI 改写成文";
  if (type === "post_draft_rewrite") return "中文改写";
  if (type === "post_draft_translate") return "英文生成";
  if (type === "post_draft_metadata") return "元信息生成";
  return type;
}

function statusTone(status: string) {
  if (status === "succeeded") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function normalizeSteps(output: Record<string, unknown> | null): DraftStep[] {
  const storedSteps = Array.isArray(output?.steps) ? output.steps : [];

  return draftSteps.map((definition) => {
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

function progressFromSteps(steps: DraftStep[]) {
  const done = steps.filter(
    (step) => step.status === "succeeded" || step.status === "skipped"
  ).length;
  return Math.round((done / steps.length) * 100);
}

function titleFromOutput(output: Record<string, unknown> | null) {
  const zh = toRecord(output?.zh);
  const en = toRecord(output?.en);
  const metadata = toRecord(output?.metadata);

  return (
    (typeof zh.title === "string" && zh.title) ||
    (typeof en.title === "string" && en.title) ||
    (typeof metadata.slug === "string" && metadata.slug) ||
    "待生成标题"
  );
}

function stepIcon(status: DraftStepStatus) {
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

export default async function PostAiProgressPage() {
  const user = await requireContentEditor();
  const jobs = await listRecentPostDraftJobsForUser(user, 80);
  const activeCount = jobs.filter((job) =>
    ["queued", "running"].includes(job.status)
  ).length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const succeededCount = jobs.filter((job) => job.status === "succeeded").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            AI 进度
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            查看文章改写、生成草稿、封面排队等后台步骤；失败任务可继续生成，不会丢弃已完成的中间结果。
          </p>
        </div>
        <Link href="/posts/new" className={buttonClassName("primary", "shrink-0")}>
          <FileText size={17} />
          AI 改写新文章
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">进行中</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {activeCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">失败可继续</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {failedCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">已完成</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {succeededCount}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[150px]" />
              <col className="w-[360px]" />
              <col className="w-[180px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">任务</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">进度</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const output = job.output ?? null;
                const steps =
                  job.type === "post_draft_create" ? normalizeSteps(output) : [];
                const progress =
                  job.type === "post_draft_create"
                    ? progressFromSteps(steps)
                    : job.status === "succeeded"
                      ? 100
                      : job.status === "failed"
                        ? 0
                        : 50;
                const outputRecord = output ?? {};
                const postEditUrl =
                  typeof outputRecord.postEditUrl === "string"
                    ? outputRecord.postEditUrl
                    : "";
                const message =
                  typeof outputRecord.message === "string"
                    ? outputRecord.message
                    : "";

                return (
                  <tr key={job.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="truncate font-medium text-slate-950">
                        {titleFromOutput(output)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {jobTypeLabel(job.type)} · 第 {job.attempts} 次执行
                      </p>
                      {message ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                          {message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${statusTone(job.status)}`}
                      >
                        {job.status === "running" ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : job.status === "queued" ? (
                          <Clock3 size={13} />
                        ) : null}
                        {jobStatusLabel(job.status)}
                      </span>
                      {job.error ? (
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-rose-600">
                          {job.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span>{progress}%</span>
                          <span>{jobStatusLabel(job.status)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {steps.length ? (
                          <div className="grid grid-cols-3 gap-1">
                            {steps.map((step) => (
                              <div
                                key={step.key}
                                className="flex min-w-0 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1"
                                title={step.message ?? step.label}
                              >
                                {stepIcon(step.status)}
                                <span className="truncate text-xs text-slate-600">
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            旧任务没有分步进度。
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                      <p>创建：{formatDate(job.createdAt)}</p>
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
                        {job.status === "failed" ? (
                          <AiJobRetryButton jobId={job.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    暂无文章 AI 任务。
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
