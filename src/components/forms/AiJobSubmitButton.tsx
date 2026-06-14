"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";

type ActionState = {
  error?: string;
  success?: string;
  jobId?: string;
};

type AiJobPayload = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string;
  output?: Record<string, unknown> | null;
};

type AiJobResponse = {
  job?: AiJobPayload;
  error?: string;
};

function statusText(status: AiJobPayload["status"] | undefined) {
  if (status === "queued") return "任务已提交，等待执行...";
  if (status === "running") return "AI 正在后台生成...";
  if (status === "succeeded") return "AI 任务已完成。";
  if (status === "failed") return "AI 任务失败。";
  return "";
}

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

export function AiJobSubmitButton({
  action,
  children,
  label = "AI 生成",
  pendingLabel = "AI 任务提交中...",
  completedMessage = "AI 任务已完成。",
  className
}: {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  label?: string;
  pendingLabel?: string;
  completedMessage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {});
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

          setJobMessage(statusText(job.status));

          if (job.status === "succeeded") {
            setJobMessage(completedMessage);
            router.refresh();
            return;
          }

          if (job.status === "failed") {
            setJobError(job.error || "AI 任务失败。");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        if (!cancelled) {
          setJobError("AI 任务仍在后台运行，请稍后刷新页面查看结果。");
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
  }, [completedMessage, router, state.jobId]);

  return (
    <form action={formAction} className="grid gap-2">
      {children}
      <button
        type="submit"
        disabled={isPending || isPolling}
        className={buttonClassName("secondary", className)}
      >
        {isPending || isPolling ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <Sparkles size={16} />
        )}
        {isPending || isPolling ? pendingLabel : label}
      </button>
      {state.error ? (
        <p className="text-xs text-rose-600">{state.error}</p>
      ) : null}
      {jobError ? <p className="text-xs text-rose-600">{jobError}</p> : null}
      {!jobError && (jobMessage || state.success) ? (
        <p className="text-xs text-slate-500">{jobMessage || state.success}</p>
      ) : null}
    </form>
  );
}
