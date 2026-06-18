"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";

type AiJobResponse = {
  job?: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed";
    error?: string;
  };
  error?: string;
};

export function AiJobRetryButton({
  jobId,
  label = "继续生成"
}: {
  jobId: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function retryJob() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ai/jobs/${jobId}`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AiJobResponse;

      if (!response.ok || payload.error) {
        setError(payload.error || "AI 任务继续失败。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        className={buttonClassName("secondary", "min-h-8 px-2")}
        onClick={retryJob}
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RotateCcw size={14} />
        )}
        {isPending ? "提交中..." : label}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
