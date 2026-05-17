"use client";

import { useActionState } from "react";

import { Field, inputClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
};

export function AiSettingsForm({
  action,
  hasApiKey,
  apiKeyPreview,
  apiBaseUrl,
  model,
  timeoutMs
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  hasApiKey: boolean;
  apiKeyPreview: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-5">
      {state.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        API Key 状态：{" "}
        <span className="font-medium text-slate-900">
          {hasApiKey ? `已配置（${apiKeyPreview}）` : "未配置"}
        </span>
      </div>

      <Field
        label="API Key"
        hint="留空会保留现有密钥。完整密钥会在服务端加密保存，不会完整显示。"
      >
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          className={inputClassName}
          placeholder={hasApiKey ? "保留现有密钥" : "sk-..."}
        />
      </Field>

      <Field
        label="API Base URL"
        hint="使用 OpenAI 兼容的 /v1 端点。官方 OpenAI API 可保留默认值。"
      >
        <input
          name="apiBaseUrl"
          type="url"
          defaultValue={apiBaseUrl}
          className={inputClassName}
          placeholder="https://api.openai.com/v1"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="模型">
          <input
            name="model"
            defaultValue={model}
            required
            className={inputClassName}
          />
        </Field>
        <Field label="超时时间（毫秒）">
          <input
            name="timeoutMs"
            type="number"
            min={5000}
            max={180000}
            step={1000}
            defaultValue={timeoutMs}
            required
            className={inputClassName}
          />
        </Field>
      </div>

      <div>
        <SubmitButton>保存 AI 设置</SubmitButton>
      </div>
    </form>
  );
}
