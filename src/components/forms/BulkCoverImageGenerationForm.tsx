"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Loader2,
  SkipForward,
  XCircle
} from "lucide-react";

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

function coverDimensions(post: PostOption) {
  if (!post.coverWidth || !post.coverHeight) return "-";
  return `${post.coverWidth} x ${post.coverHeight}`;
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
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<NonNullable<AiJobResponse["job"]>["output"]>(null);
  const eligiblePostIds = useMemo(
    () =>
      posts
        .filter((post) => overwriteExisting || !post.coverImage)
        .map((post) => post.id),
    [overwriteExisting, posts]
  );
  const eligiblePostIdSet = useMemo(() => new Set(eligiblePostIds), [eligiblePostIds]);
  const batchSelectablePostIds = useMemo(() => eligiblePostIds.slice(0, 10), [eligiblePostIds]);
  const batchSelectablePostIdSet = useMemo(
    () => new Set(batchSelectablePostIds),
    [batchSelectablePostIds]
  );
  const selectedEligiblePostIds = useMemo(
    () => selectedPostIds.filter((id) => eligiblePostIdSet.has(id)),
    [eligiblePostIdSet, selectedPostIds]
  );
  const selectedEligiblePostIdSet = useMemo(
    () => new Set(selectedEligiblePostIds),
    [selectedEligiblePostIds]
  );
  const availableCount = eligiblePostIds.length;
  const selectedEligibleCount = selectedEligiblePostIds.length;
  const batchSelectableCount = batchSelectablePostIds.length;
  const selectedBatchCount = selectedEligiblePostIds.filter((id) =>
    batchSelectablePostIdSet.has(id)
  ).length;
  const allVisibleSelected =
    batchSelectableCount > 0 &&
    batchSelectablePostIds.every((id) => selectedEligiblePostIdSet.has(id));
  const someVisibleSelected =
    selectedBatchCount > 0 && selectedBatchCount < batchSelectableCount;

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

  function togglePostSelection(postId: string, checked: boolean) {
    setSelectedPostIds((current) => {
      if (checked) {
        const currentEligible = current.filter((id) => eligiblePostIdSet.has(id));
        if (currentEligible.includes(postId)) return currentEligible;
        return [...currentEligible, postId].slice(0, 10);
      }

      return current.filter((id) => id !== postId);
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedPostIds((current) => {
      if (checked) return batchSelectablePostIds;
      return current.filter((id) => !batchSelectablePostIdSet.has(id));
    });
  }

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {selectedEligiblePostIds.map((postId) => (
        <input key={postId} type="hidden" name="postIds" value={postId} />
      ))}
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
            <span className="text-sm text-slate-500">
              已选 {selectedEligibleCount}/{batchSelectableCount}
            </span>
            <button
              type="submit"
              disabled={isPending || isPolling || selectedEligibleCount === 0}
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

          <div className="mt-4 max-h-[420px] overflow-auto rounded-md border border-slate-200">
            <table className="min-w-[1160px] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-12 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleSelected;
                      }}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                      disabled={batchSelectableCount === 0}
                      className="h-4 w-4 rounded border-slate-300 text-slate-700"
                      aria-label="选择当前列表前 10 篇可生成封面的文章"
                    />
                  </th>
                  <th className="px-3 py-2">文章</th>
                  <th className="w-36 px-3 py-2">分类</th>
                  <th className="w-24 px-3 py-2">状态</th>
                  <th className="w-28 px-3 py-2">当前封面</th>
                  <th className="w-40 px-3 py-2">最新生成</th>
                  <th className="w-24 px-3 py-2">格式</th>
                  <th className="w-28 px-3 py-2">尺寸</th>
                  <th className="w-28 px-3 py-2">文件大小</th>
                  <th className="w-44 px-3 py-2">模型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {posts.map((post) => {
                  const isDisabled = !overwriteExisting && Boolean(post.coverImage);
                  const isSelected = selectedEligiblePostIdSet.has(post.id);

                  return (
                    <tr
                      key={post.id}
                      className={`align-top ${
                        isDisabled
                          ? "bg-slate-50 text-slate-400"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          value={post.id}
                          checked={isSelected}
                          onChange={(event) =>
                            togglePostSelection(post.id, event.target.checked)
                          }
                          disabled={isDisabled || (!isSelected && selectedEligibleCount >= 10)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-700"
                          aria-label={`选择文章：${post.title}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[340px]">
                          <p className="truncate font-medium text-slate-900">
                            {post.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {post.slug}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex max-w-[140px] items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          <span className="truncate">
                            {post.categoryName || post.categorySlug || "-"}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          {post.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {post.coverImage ? (
                          <span className="text-slate-700">已有封面</span>
                        ) : (
                          <span className="text-slate-500">无封面</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDate(coverGeneratedDate(post))}
                      </td>
                      <td className="px-3 py-3">
                        {post.coverImage ? imageFormatLabel(post.coverMimeType) : "-"}
                      </td>
                      <td className="px-3 py-3">{coverDimensions(post)}</td>
                      <td className="px-3 py-3">
                        {formatFileSize(post.coverFileSize)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block max-w-[180px] truncate">
                          {post.coverModel || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {posts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                暂无可生成封面的文章。
              </p>
            ) : null}
            {posts.length > 0 && availableCount === 0 ? (
              <p className="border-t border-slate-200 px-2 py-6 text-center text-sm text-slate-500">
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
