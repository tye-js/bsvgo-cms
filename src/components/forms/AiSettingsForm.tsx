"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { AiWritingRoleId } from "@/lib/ai-style";

type ActionState = {
  error?: string;
  success?: string;
};

type SettingsTab = "provider" | "writing" | "roles" | "seo";

const deepSeekBaseUrl = "https://api.deepseek.com";
const deepSeekModel = "deepseek-v4-pro";

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
    zhName: string;
    enName: string;
    avatar: string;
    description: string;
    style: string;
  }>;
  zhSeoStyle: string;
  enSeoStyle: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [activeTab, setActiveTab] = useState<SettingsTab>("provider");
  const [apiBaseUrlValue, setApiBaseUrlValue] = useState(apiBaseUrl);
  const [modelValue, setModelValue] = useState(model);
  const [timeoutMsValue, setTimeoutMsValue] = useState(timeoutMs);
  const [writingStyleValue, setWritingStyleValue] = useState(writingStyle);
  const [defaultWritingRoleValue, setDefaultWritingRoleValue] = useState(
    defaultWritingRole as AiWritingRoleId
  );
  const [roleStyleValues, setRoleStyleValues] = useState<
    Record<AiWritingRoleId, string>
  >(
    Object.fromEntries(
      writingRoles.map((role) => [role.id, role.style])
    ) as Record<AiWritingRoleId, string>
  );
  const [zhSeoStyleValue, setZhSeoStyleValue] = useState(zhSeoStyle);
  const [enSeoStyleValue, setEnSeoStyleValue] = useState(enSeoStyle);
  const [editingRoleId, setEditingRoleId] = useState<AiWritingRoleId>(
    defaultWritingRole as AiWritingRoleId
  );
  const editingRole =
    writingRoles.find((role) => role.id === editingRoleId) ?? writingRoles[0];
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "provider", label: "模型连接" },
    { id: "writing", label: "写作底线" },
    { id: "roles", label: "AI 角色" },
    { id: "seo", label: "SEO 风格" }
  ];

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
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="apiBaseUrl" value={apiBaseUrlValue} />
          <input type="hidden" name="model" value={modelValue} />
          <input type="hidden" name="timeoutMs" value={timeoutMsValue} />
          <input type="hidden" name="defaultWritingRole" value={defaultWritingRoleValue} />
          <textarea className="hidden" name="writingStyle" value={writingStyleValue} readOnly />
          <textarea className="hidden" name="zhSeoStyle" value={zhSeoStyleValue} readOnly />
          <textarea className="hidden" name="enSeoStyle" value={enSeoStyleValue} readOnly />
          {writingRoles.map((role) => (
            <textarea
              key={role.id}
              className="hidden"
              name={`writingRoleStyle.${role.id}`}
              value={roleStyleValues[role.id] ?? role.style}
              readOnly
            />
          ))}

          {activeTab === "provider" ? (
            <div className="grid gap-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                API Key 状态：{" "}
                <span className="font-medium text-slate-900">
                  {hasApiKey ? `已配置（${apiKeyPreview}）` : "未配置"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-600">
                  DeepSeek 使用 OpenAI-compatible Chat Completions。点击可快速填入 DeepSeek 连接参数。
                </p>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => {
                    setApiBaseUrlValue(deepSeekBaseUrl);
                    setModelValue(deepSeekModel);
                  }}
                >
                  使用 DeepSeek
                </button>
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
                hint="DeepSeek 填 https://api.deepseek.com；OpenAI 填 https://api.openai.com/v1。"
              >
                <input
                  type="url"
                  value={apiBaseUrlValue}
                  onChange={(event) => setApiBaseUrlValue(event.target.value)}
                  className={inputClassName}
                  placeholder="https://api.deepseek.com"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <Field label="模型">
                  <input
                    value={modelValue}
                    onChange={(event) => setModelValue(event.target.value)}
                    required
                    className={inputClassName}
                  />
                </Field>
                <Field label="超时时间（毫秒）">
                  <input
                    type="number"
                    min={5000}
                    max={180000}
                    step={1000}
                    value={timeoutMsValue}
                    onChange={(event) => setTimeoutMsValue(event.target.value)}
                    required
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {activeTab === "writing" ? (
            <div className="grid gap-5">
              <Field
                label="全局写作底线"
                hint="所有角色都会遵守的硬规则。建议覆盖事实约束、受众、Markdown、营销边界、双语语气、Slug 和 SEO。"
              >
                <textarea
                  value={writingStyleValue}
                  onChange={(event) => setWritingStyleValue(event.target.value)}
                  maxLength={2000}
                  className={textareaClassName}
                  placeholder="例如：面向 BSVgo 技术读者；只基于素材写作；Markdown 正文；适度营销但不夸大；Slug 简短准确；中英文 SEO 分别优化..."
                />
              </Field>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                建议写作底线包含：事实来源、禁止编造、读者画像、文章结构、营销尺度、Markdown 格式、中文/英文语气、Slug 规则、SEO 关键词规则。
              </div>

              <Field
                label="默认写作角色"
                hint="新建文章页会默认选中这个角色，每篇文章生成前仍可临时切换。"
              >
                <select
                  value={defaultWritingRoleValue}
                  onChange={(event) =>
                    setDefaultWritingRoleValue(event.target.value as AiWritingRoleId)
                  }
                  className={inputClassName}
                >
                  {writingRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {activeTab === "roles" && editingRole ? (
            <div className="grid gap-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">AI 角色设置</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  先选择一个角色，再编辑该角色的具体写作要求。其他角色会保留原配置。
                </p>
              </div>
              <Field label="选择角色" hint={editingRole.description}>
                <select
                  value={editingRoleId}
                  onChange={(event) =>
                    setEditingRoleId(event.target.value as AiWritingRoleId)
                  }
                  className={inputClassName}
                >
                  {writingRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Image
                  src={editingRole.avatar}
                  alt={editingRole.zhName}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded-full bg-white"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {editingRole.zhName}
                  </p>
                  <p className="text-xs text-slate-500">{editingRole.enName}</p>
                </div>
              </div>
              <Field label={`${editingRole.label}的写作要求`}>
                <textarea
                  value={roleStyleValues[editingRole.id] ?? editingRole.style}
                  onChange={(event) =>
                    setRoleStyleValues((current) => ({
                      ...current,
                      [editingRole.id]: event.target.value
                    }))
                  }
                  maxLength={2000}
                  className={`${textareaClassName} min-h-44`}
                />
              </Field>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                角色配置只写该角色的差异化风格，不要重复全局底线。建议明确：适合内容类型、开头方式、结构重点、语气、证据使用方式、营销或观点尺度。
              </div>
            </div>
          ) : null}

          {activeTab === "seo" ? (
            <div className="grid gap-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">AI SEO 风格</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  用于文章、分类、标签和首页的双语 SEO 生成。中文 SEO 和英文 SEO 分别服务对应前端入口。
                </p>
              </div>
              <Field label="中文 SEO 风格">
                <textarea
                  value={zhSeoStyleValue}
                  onChange={(event) => setZhSeoStyleValue(event.target.value)}
                  maxLength={2000}
                  className={`${textareaClassName} min-h-32`}
                />
              </Field>
              <Field label="英文 SEO 风格">
                <textarea
                  value={enSeoStyleValue}
                  onChange={(event) => setEnSeoStyleValue(event.target.value)}
                  maxLength={2000}
                  className={`${textareaClassName} min-h-32`}
                />
              </Field>
            </div>
          ) : null}
        </section>

      <div>
        <SubmitButton>保存 AI 设置</SubmitButton>
      </div>
      </PendingFieldset>
    </form>
  );
}
