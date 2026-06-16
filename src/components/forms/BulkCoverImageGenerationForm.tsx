"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ImagePlus, Loader2, SkipForward, XCircle } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";

type ActionState = {
  error?: string;
  success?: string;
  jobId?: string;
};

type PostOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  coverImage: string;
  categorySlug: string;
  categoryName: string;
  coverAssetId?: string | null;
  coverMimeType?: string | null;
  coverWidth?: number | null;
  coverHeight?: number | null;
  coverFileSize?: number | null;
  coverGeneratedAt?: string | null;
  coverModel?: string | null;
  coverStorageProvider?: string | null;
  coverCreatedAt?: Date | string | null;
};

type AiJobResponse = {
  job?: {
    status: "queued" | "running" | "succeeded" | "failed";
    error?: string;
    output?: {
      generated?: number;
      skipped?: number;
      processed?: number;
      total?: number;
      currentTitle?: string;
      items?: Array<{
        postId: string;
        title: string;
        status: "pending" | "running" | "generated" | "skipped" | "failed";
        message?: string;
      }>;
    } | null;
  };
  error?: string;
};

async function readJob(jobId: string) {
  const response = await fetch(`/api/ai/jobs/${jobId}`, { cache: "no-store" });
  const payload = (await response.json()) as AiJobResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error || "AI 任务状态读取失败。");
  }

  if (!payload.job) {
    throw new Error("AI 任务不存在。");
  }

  return payload.job;
}

function formatFileSize(size: number | null | undefined) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function imageFormatLabel(mimeType: string | null | undefined) {
  if (!mimeType) return "格式未知";
  if (mimeType === "image/webp") return "WebP";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPEG";
  if (mimeType === "image/avif") return "AVIF";
  return mimeType.replace(/^image\//, "").toUpperCase();
}

function coverGeneratedDate(post: PostOption) {
  return post.coverGeneratedAt || post.coverCreatedAt || null;
}

export function BulkCoverImageGenerationForm({
  action,
  posts,
  defaultExpanded = false
}: {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  posts: PostOption[];
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {});
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [progress, setProgress] = useState<NonNullable<AiJobResponse["job"]>["output"]>(null);
  const availableCount = overwriteExisting
    ? posts.length
    : posts.filter((post) => !post.coverImage).length;

  useEffect(() => {
    if (!state.jobId) return;

    let cancelled = false;

    async function poll() {
      setIsPolling(true);
      setJobError("");

      try {
        for (let attempt = 0; attempt < 300; attempt += 1) {
          const job = await readJob(state.jobId ?? "");
          if (cancelled) return;
          setProgress(job.output ?? null);

          const generated = Number(job.output?.generated ?? 0);
          const processed = Number(job.output?.processed ?? generated);
          const total = Number(job.output?.total ?? 0);
          const currentTitle = job.output?.currentTitle;
          const progressText =
            total > 0
              ? `已处理 ${processed}/${total}，已生成 ${generated} 张`
              : "";

          if (job.status === "queued") {
            setJobMessage("封面生成任务已提交，等待执行...");
          } else if (job.status === "running") {
            setJobMessage(
              currentTitle
                ? `AI 正在生成《${currentTitle}》的封面。${progressText}`
                : `AI 正在后台生成文章封面。${progressText}`
            );
          } else if (job.status === "succeeded") {
            setJobMessage(
              generated > 0
                ? `已生成 ${generated} 张文章封面，并写入媒体库。`
                : "任务完成，没有生成新的封面。"
            );
            router.refresh();
            return;
          } else {
            setJobError(job.error || "文章封面生成失败。");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!cancelled) {
          setJobMessage("封面生成任务仍在后台运行，进度已保存，可稍后刷新页面查看。");
        }
      } catch (error) {
        if (!cancelled) {
          setJobError(error instanceof Error ? error.message : "AI 任务状态读取失败。");
        }
      } finally {
        if (!cancelled) setIsPolling(false);
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
  }, [router, state.jobId]);

  const total = Number(progress?.total ?? 0);
  const processed = Number(progress?.processed ?? 0);
  const generated = Number(progress?.generated ?? 0);
  const skipped = Number(progress?.skipped ?? 0);
  const progressPercent =
    total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="font-semibold text-slate-950">文章封面生成</h2>
          <p className="mt-1 text-sm text-slate-500">
            按文章标题、描述和大分类批量生成封面。一次最多处理 10 篇。
          </p>
        </div>
        {defaultExpanded ? null : (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={buttonClassName("secondary", "shrink-0")}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={16}
              className={`transition ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "收起" : "展开"}
          </button>
        )}
      </div>

      {expanded ? (
        <>
          <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="overwriteExisting"
                checked={overwriteExisting}
                onChange={(event) => setOverwriteExisting(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-700"
              />
              覆盖已有封面的文章
            </label>
            <button
              type="submit"
              disabled={isPending || isPolling || availableCount === 0}
              className={buttonClassName("primary", "shrink-0")}
            >
              {isPending || isPolling ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : (
                <ImagePlus size={16} />
              )}
              {isPending || isPolling ? "后台生成中..." : "生成选中文章封面"}
            </button>
          </div>

          <div className="mt-4 grid max-h-72 gap-2 overflow-auto rounded-md border border-slate-200 p-2">
            {posts.map((post) => (
              <label
                key={post.id}
                className={`flex items-start gap-3 rounded-md px-2 py-2 text-sm ${
                  !overwriteExisting && post.coverImage
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  name="postIds"
                  value={post.id}
                  disabled={!overwriteExisting && Boolean(post.coverImage)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-700"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">
                    {post.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {post.categoryName || post.categorySlug} · {post.slug} ·{" "}
                    {post.status} · {post.coverImage ? "已有封面" : "无封面"}
                  </span>
                  {post.coverImage ? (
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      最新生成：{formatDate(coverGeneratedDate(post))} ·{" "}
                      {imageFormatLabel(post.coverMimeType)}
                      {post.coverWidth && post.coverHeight
                        ? ` · ${post.coverWidth} x ${post.coverHeight}`
                        : ""}{" "}
                      · {formatFileSize(post.coverFileSize)}
                      {post.coverModel ? ` · ${post.coverModel}` : ""}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
            {posts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                暂无可生成封面的文章。
              </p>
            ) : null}
            {posts.length > 0 && availableCount === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                当前列表文章都已有封面。如需重新生成，请勾选覆盖已有封面的文章。
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="mt-3 grid gap-2 text-sm">
        {state.error ? <p className="text-rose-600">{state.error}</p> : null}
        {jobError ? <p className="text-rose-600">{jobError}</p> : null}
        {!jobError && (jobMessage || state.success) ? (
          <p className="text-slate-500">{jobMessage || state.success}</p>
        ) : null}
      </div>

      {progress && total > 0 ? (
        <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-900">
              任务进度 {progressPercent}%
            </span>
            <span className="text-slate-500">
              已处理 {processed}/{total} · 已生成 {generated} · 已跳过 {skipped}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-700 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.currentTitle ? (
            <p className="text-sm text-slate-600">
              当前文章：{progress.currentTitle}
            </p>
          ) : null}
          {progress.items?.length ? (
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-white">
              {progress.items.map((item) => (
                <div
                  key={item.postId}
                  className="flex items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                >
                  {item.status === "generated" ? (
                    <CheckCircle2 className="mt-0.5 text-emerald-600" size={16} />
                  ) : item.status === "running" ? (
                    <Loader2 className="mt-0.5 animate-spin text-slate-600" size={16} />
                  ) : item.status === "skipped" ? (
                    <SkipForward className="mt-0.5 text-amber-600" size={16} />
                  ) : item.status === "failed" ? (
                    <XCircle className="mt-0.5 text-rose-600" size={16} />
                  ) : (
                    <span className="mt-1 h-3.5 w-3.5 rounded-full border border-slate-300" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {item.title}
                    </p>
                    {item.message ? (
                      <p className="text-xs text-slate-500">{item.message}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
