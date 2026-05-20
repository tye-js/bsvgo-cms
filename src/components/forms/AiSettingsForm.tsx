"use client";

import { useActionState } from "react";

import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { AiWritingRoleId } from "@/lib/ai-style";

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
  timeoutMs,
  writingStyle,
  defaultWritingRole,
  writingRoles,
  zhSeoStyle,
  enSeoStyle
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
  writingStyle: string;
  defaultWritingRole: string;
  writingRoles: Array<{
    id: AiWritingRoleId;
    label: string;
    description: string;
    style: string;
  }>;
  zhSeoStyle: string;
  enSeoStyle: string;
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

      <PendingFieldset className="gap-5">
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

      <Field
        label="全局写作底线"
        hint="所有角色都会遵守的基础要求，比如事实约束、受众、禁忌和 Markdown 结构。"
      >
        <textarea
          name="writingStyle"
          defaultValue={writingStyle}
          maxLength={2000}
          className={textareaClassName}
          placeholder="例如：面向技术读者，客观清晰，短段落，多用小标题，不夸大..."
        />
      </Field>

      <Field
        label="默认写作角色"
        hint="新建文章页会默认选中这个角色，每次 AI 改写前仍可临时切换。"
      >
        <select
          name="defaultWritingRole"
          defaultValue={defaultWritingRole}
          className={inputClassName}
        >
          {writingRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">AI 写作角色</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            每个角色会叠加到全局写作底线上。适合把技术文章、资讯分析、产品营销、科普和观点稿拆开调教。
          </p>
        </div>
        <div className="grid gap-4">
          {writingRoles.map((role) => (
            <Field
              key={role.id}
              label={role.label}
              hint={role.description}
            >
              <textarea
                name={`writingRoleStyle.${role.id}`}
                defaultValue={role.style}
                maxLength={2000}
                className={`${textareaClassName} min-h-28`}
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">AI SEO 风格</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            用于文章、分类、标签和首页的双语 SEO 生成。中文 SEO 和英文 SEO 会分别服务对应前端入口。
          </p>
        </div>
        <Field label="中文 SEO 风格">
          <textarea
            name="zhSeoStyle"
            defaultValue={zhSeoStyle}
            maxLength={2000}
            className={`${textareaClassName} min-h-28`}
          />
        </Field>
        <Field label="英文 SEO 风格">
          <textarea
            name="enSeoStyle"
            defaultValue={enSeoStyle}
            maxLength={2000}
            className={`${textareaClassName} min-h-28`}
          />
        </Field>
      </section>

      <div>
        <SubmitButton>保存 AI 设置</SubmitButton>
      </div>
      </PendingFieldset>
    </form>
  );
}
