import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";

import { BulkCoverImageGenerationForm } from "@/components/forms/BulkCoverImageGenerationForm";
import { buttonClassName } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";
import { listRecentCoverImageJobsForUser } from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";
import { bulkGeneratePostCoverImagesAction } from "@/server/media/actions";
import { getPostCoverGenerationOptions } from "@/server/media/service";

function jobStatusLabel(status: string) {
  if (status === "queued") return "排队中";
  if (status === "running") return "生成中";
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "失败";
  return status;
}

export default async function MediaCoverGenerationPage() {
  const user = await requireContentEditor();
  const [coverPostOptions, recentJobs] = await Promise.all([
    getPostCoverGenerationOptions(100),
    listRecentCoverImageJobsForUser(user)
  ]);
  const withoutCoverCount = coverPostOptions.filter((post) => !post.coverImage).length;
  const withCoverCount = coverPostOptions.length - withoutCoverCount;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/media"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            返回媒体库
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            文章封面生成
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            按文章标题、描述和大分类批量生成封面，并自动写入媒体库和文章封面字段。
          </p>
        </div>
        <Link href="/media/new" className={buttonClassName("secondary", "shrink-0")}>
          <ImagePlus size={17} />
          手动新建图片
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">可选文章</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {coverPostOptions.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">无封面</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {withoutCoverCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">已有封面</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {withCoverCount}
          </p>
        </div>
      </section>

      <BulkCoverImageGenerationForm
        action={bulkGeneratePostCoverImagesAction}
        posts={coverPostOptions}
        defaultExpanded
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">最近封面生成任务</h2>
          <p className="mt-1 text-sm text-slate-500">
            任务进度会写入数据库，刷新页面后仍可查看最近任务状态。
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {recentJobs.map((job) => {
            const output = job.output ?? {};
            const total = Number(output.total ?? 0);
            const processed = Number(output.processed ?? output.generated ?? 0);
            const generated = Number(output.generated ?? 0);
            const skipped = Number(output.skipped ?? 0);
            const percent =
              total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;

            return (
              <div key={job.id} className="grid gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">
                      {jobStatusLabel(job.status)} · {percent}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(new Date(job.createdAt))} · 已处理 {processed}/{total} ·
                      已生成 {generated} · 已跳过 {skipped}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                    {job.status}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {job.error ? (
                  <p className="text-sm text-rose-600">{job.error}</p>
                ) : output.currentTitle ? (
                  <p className="text-sm text-slate-500">
                    当前文章：{String(output.currentTitle)}
                  </p>
                ) : null}
              </div>
            );
          })}
          {recentJobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              暂无封面生成任务。
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
