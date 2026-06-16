"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";

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
};

type AiJobResponse = {
  job?: {
    status: "queued" | "running" | "succeeded" | "failed";
    error?: string;
    output?: {
      generated?: number;
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

export function BulkCoverImageGenerationForm({
  action,
  posts
}: {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  posts: PostOption[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {});
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
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

          if (job.status === "queued") {
            setJobMessage("封面生成任务已提交，等待执行...");
          } else if (job.status === "running") {
            setJobMessage("AI 正在后台生成文章封面...");
          } else if (job.status === "succeeded") {
            const generated = Number(job.output?.generated ?? 0);
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
          setJobError("封面生成任务仍在后台运行，请稍后刷新页面查看结果。");
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

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="font-semibold text-slate-950">文章封面生成</h2>
          <p className="mt-1 text-sm text-slate-500">
            按文章标题、描述和大分类批量生成封面。一次最多处理 10 篇。
          </p>
        </div>
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
    </form>
  );
}
