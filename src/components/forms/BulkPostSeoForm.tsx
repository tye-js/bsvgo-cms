"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
};

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
  const [state, formAction] = useActionState(action, {});

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
        </div>
        <SubmitButton pendingLabel="AI 生成中..." timeoutMs={120000}>
          <Sparkles size={16} />
          批量 AI 生成 SEO
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
