import Link from "next/link";
import { Clock3, Loader2, SearchCheck } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
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
  listAiJobsForUser
} from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";
import type { AiJobStatus, AiJobType } from "@/server/db/schema";

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

  const postEditUrl = output.postEditUrl;
  if (typeof postEditUrl === "string" && postEditUrl) return "文章草稿已创建";

  return "查看详情";
}

export default async function AiJobsPage({
  searchParams
}: {
  searchParams: Promise<{
    type?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireContentEditor();
  const type = aiJobTypeValues.includes(params.type as AiJobType)
    ? (params.type as AiJobType)
    : "all";
  const status = aiJobStatusValues.includes(params.status as AiJobStatus)
    ? (params.status as AiJobStatus)
    : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { rows, total, pageSize } = await listAiJobsForUser({
    user,
    type,
    status,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const activeCount = rows.filter((job) =>
    ["queued", "running"].includes(job.status)
  ).length;
  const failedCount = rows.filter((job) => job.status === "failed").length;

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (type !== "all") search.set("type", type);
    if (status !== "all") search.set("status", status);
    search.set("page", String(nextPage));
    return `/ai/jobs?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            AI 任务中心
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            统一查看文章改写、SEO、媒体 SEO、封面生成等后台 AI 任务，失败任务可继续生成。
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
          <div className="border-r border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">当前页</p>
            <p className="mt-1 font-semibold text-slate-950">{rows.length}</p>
          </div>
          <div className="border-r border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">进行中</p>
            <p className="mt-1 font-semibold text-slate-950">{activeCount}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-slate-500">失败</p>
            <p className="mt-1 font-semibold text-slate-950">{failedCount}</p>
          </div>
        </div>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[220px_180px_auto]">
        <select name="type" defaultValue={type} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
          <option value="all">全部任务类型</option>
          {aiJobTypeValues.map((value) => (
            <option key={value} value={value}>
              {aiJobTypeLabel(value)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
          <option value="all">全部状态</option>
          {aiJobStatusValues.map((value) => (
            <option key={value} value={value}>
              {aiJobStatusLabel(value)}
            </option>
          ))}
        </select>
        <input type="hidden" name="page" value="1" />
        <button className={buttonClassName("secondary")} type="submit">
          <SearchCheck size={16} />
          筛选
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[130px]" />
              <col className="w-[340px]" />
              <col className="w-[210px]" />
              <col className="w-[190px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">任务</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">摘要</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link
                      href={`/ai/jobs/${job.id}`}
                      className="font-medium text-slate-950 hover:text-slate-700 hover:underline"
                    >
                      {aiJobTypeLabel(job.type)}
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {job.id}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      第 {job.attempts} 次执行
                    </p>
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
                  <td className="px-4 py-4 text-slate-600">
                    <p className="line-clamp-3 leading-6">
                      {outputSummary(job.output)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                    <p>创建：{formatDate(job.createdAt)}</p>
                    <p>开始：{formatDate(job.startedAt)}</p>
                    <p>完成：{formatDate(job.finishedAt)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid justify-items-start gap-2">
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
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    暂无 AI 任务。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
    </div>
  );
}
