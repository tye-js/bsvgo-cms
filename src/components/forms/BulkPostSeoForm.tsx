"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
  jobId?: string;
};

type AiJobResponse = {
  job?: {
    status: "queued" | "running" | "succeeded" | "failed";
    error?: string;
    output?: {
      updated?: number;
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

export function BulkPostSeoForm({
  action,
  children
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, {});
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!state.jobId) return;

    let cancelled = false;

    async function poll() {
      setIsPolling(true);
      setJobError("");

      try {
        for (let attempt = 0; attempt < 240; attempt += 1) {
          const job = await readJob(state.jobId ?? "");
          if (cancelled) return;

          if (job.status === "queued") {
            setJobMessage("SEO 生成任务已提交，等待执行...");
          } else if (job.status === "running") {
            setJobMessage("SEO 正在后台生成...");
          } else if (job.status === "succeeded") {
            const updated = Number(job.output?.updated ?? 0);
            setJobMessage(
              updated > 0
                ? `已为 ${updated} 篇文章生成 SEO，请检查后发布。`
                : "SEO 生成任务已完成。"
            );
            router.refresh();
            return;
          } else {
            setJobError(job.error || "SEO 生成任务失败。");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        if (!cancelled) {
          setJobError("SEO 任务仍在后台运行，请稍后刷新页面查看结果。");
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
    <form action={formAction}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="grid gap-2 text-sm text-slate-500">
          <p>批量生成会按文章处理，最多选择 20 篇。</p>
          {state.error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {state.success}
            </p>
          ) : null}
          {jobError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {jobError}
            </p>
          ) : null}
          {jobMessage ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
              {jobMessage}
            </p>
          ) : null}
        </div>
        <SubmitButton
          pendingLabel={isPolling ? "AI 后台生成中..." : "AI 任务提交中..."}
          timeoutMs={120000}
          disabled={isPolling}
        >
          <Sparkles size={16} />
          {isPolling ? "AI 后台生成中..." : "批量 AI 生成 SEO"}
        </SubmitButton>
      </div>
      <div className="px-4 pb-3">
        <SubmitTimeoutNotice
          timeoutMs={120000}
          message="AI 批量生成时间较长。请等待完成，避免重复提交。"
        />
      </div>
      {children}
    </form>
  );
}
