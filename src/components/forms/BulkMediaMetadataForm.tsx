"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";

type ActionState = {
  error?: string;
  success?: string;
  jobId?: string;
};

type BulkMediaMetadataOutput = {
  updated?: number;
  skipped?: number;
  failed?: number;
  processed?: number;
  total?: number;
  currentLabel?: string;
  items?: Array<{
    mediaAssetId: string;
    label: string;
    status: "pending" | "running" | "updated" | "skipped" | "failed";
    message?: string;
  }>;
};

type AiJobResponse = {
  job?: {
    status: "queued" | "running" | "succeeded" | "failed";
    error?: string;
    output?: BulkMediaMetadataOutput | null;
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

export function BulkMediaMetadataForm({
  action,
  q,
  provider,
  usage,
  needs
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  q: string;
  provider: string;
  usage: string;
  needs: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {});
  const [isPolling, setIsPolling] = useState(false);
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState("");
  const [progress, setProgress] = useState<BulkMediaMetadataOutput | null>(null);

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

          const updated = Number(job.output?.updated ?? 0);
          const processed = Number(job.output?.processed ?? 0);
          const total = Number(job.output?.total ?? 0);
          const failed = Number(job.output?.failed ?? 0);
          const currentLabel = job.output?.currentLabel;

          if (job.status === "queued") {
            setJobMessage("媒体 AI 补全任务已提交，等待执行...");
          } else if (job.status === "running") {
            setJobMessage(
              currentLabel
                ? `AI 正在补全《${currentLabel}》。已处理 ${processed}/${total}`
                : `AI 正在批量补全媒体信息。已处理 ${processed}/${total}`
            );
          } else if (job.status === "succeeded") {
            setJobMessage(
              failed > 0
                ? `已补全 ${updated} 张图片，${failed} 张失败。`
                : `已补全 ${updated} 张图片。`
            );
            router.refresh();
            return;
          } else {
            setJobError(job.error || "媒体 AI 补全任务失败。");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!cancelled) {
          setJobMessage("媒体 AI 补全任务仍在后台运行，进度已保存，可稍后刷新页面查看。");
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
  const updated = Number(progress?.updated ?? 0);
  const failed = Number(progress?.failed ?? 0);
  const percent = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="usage" value={usage} />
      <input type="hidden" name="needs" value={needs} />
      <button
        type="submit"
        disabled={isPending || isPolling}
        className={buttonClassName("secondary", "min-h-9 px-3")}
      >
        {isPending || isPolling ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {isPending || isPolling ? "AI 补全中..." : "批量 AI 补全"}
      </button>
      {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
      {jobError ? <p className="text-xs text-rose-600">{jobError}</p> : null}
      {!jobError && (jobMessage || state.success) ? (
        <p className="text-xs text-slate-500">{jobMessage || state.success}</p>
      ) : null}
      {progress && total > 0 ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <span>任务进度 {percent}%</span>
            <span>
              已处理 {processed}/{total} · 已补全 {updated} · 失败 {failed}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-700"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress.items?.length ? (
            <div className="grid max-h-44 gap-1 overflow-y-auto">
              {progress.items.map((item) => (
                <div key={item.mediaAssetId} className="flex items-start gap-2">
                  {item.status === "updated" ? (
                    <CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />
                  ) : item.status === "failed" ? (
                    <XCircle size={14} className="mt-0.5 text-rose-600" />
                  ) : item.status === "running" ? (
                    <Loader2 size={14} className="mt-0.5 animate-spin text-slate-600" />
                  ) : (
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-300" />
                  )}
                  <span className="min-w-0 truncate">
                    {item.label}
                    {item.message ? ` · ${item.message}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
