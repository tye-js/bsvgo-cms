"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BookOpen,
  CheckCircle2,
  ImageIcon,
  KeyRound,
  Search,
  Sparkles
} from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import type { AiWritingRoleId } from "@/lib/ai-style";
import type {
  AiProviderSettingsInput,
  AiSeoStyleSettingsInput,
  AiWritingSettingsInput,
  ImageGenerationSettingsInput
} from "@/server/settings/actions";

type ActionState = {
  error?: string;
  success?: string;
};

type AiSettingsAction<Input> = (input: Input) => Promise<ActionState>;

type WritingRole = {
  id: AiWritingRoleId;
  label: string;
  zhName: string;
  enName: string;
  avatar: string;
  description: string;
  style: string;
};

type ImageGenerationValue = {
  hasApiKey: boolean;
  canReuseTextApiKey: boolean;
  apiKeyPreview: string;
  apiBaseUrl: string;
  model: string;
  size: string;
  quality: string;
  outputFormat: string;
  timeoutMs: string;
  promptStyles: {
    blockchain: string;
    ai: string;
    infrastructure: string;
  };
};

type SectionState = ActionState & {
  key?: string;
};

const deepSeekBaseUrl = "https://api.deepseek.com";
const deepSeekModel = "deepseek-v4-pro";

function StatusMessage({ state }: { state: SectionState }) {
  if (state.error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 size={16} />
        {state.success}
      </p>
    );
  }

  return null;
}

function SectionShell({
  icon,
  title,
  description,
  state,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: SectionState;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            {icon}
            {title}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <StatusMessage state={state} />
      {children}
    </section>
  );
}

function useSettingsSubmit<Input>(
  action: AiSettingsAction<Input>,
  stateKey: string,
  setState: (state: SectionState) => void
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const submit = (input: Input) => {
    setState({ key: stateKey });
    startTransition(async () => {
      const nextState = await action(input);
      setState({ ...nextState, key: stateKey });
      if (!nextState.error) {
        router.refresh();
      }
    });
  };

  return { isPending, submit };
}

export function AiSettingsForm({
  providerAction,
  writingAction,
  seoStyleAction,
  imageGenerationAction,
  hasApiKey,
  apiKeyPreview,
  apiBaseUrl,
  model,
  timeoutMs,
  writingStyle,
  defaultWritingRole,
  writingRoles,
  zhSeoStyle,
  enSeoStyle,
  imageGeneration
}: {
  providerAction: AiSettingsAction<AiProviderSettingsInput>;
  writingAction: AiSettingsAction<AiWritingSettingsInput>;
  seoStyleAction: AiSettingsAction<AiSeoStyleSettingsInput>;
  imageGenerationAction: AiSettingsAction<ImageGenerationSettingsInput>;
  hasApiKey: boolean;
  apiKeyPreview: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: string;
  writingStyle: string;
  defaultWritingRole: string;
  writingRoles: WritingRole[];
  zhSeoStyle: string;
  enSeoStyle: string;
  imageGeneration: ImageGenerationValue;
}) {
  const [state, setState] = useState<SectionState>({});
  const [apiKeyValue, setApiKeyValue] = useState("");
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
  const [editingRoleId, setEditingRoleId] = useState<AiWritingRoleId>(
    defaultWritingRole as AiWritingRoleId
  );
  const [zhSeoStyleValue, setZhSeoStyleValue] = useState(zhSeoStyle);
  const [enSeoStyleValue, setEnSeoStyleValue] = useState(enSeoStyle);
  const [imageApiKeyValue, setImageApiKeyValue] = useState("");
  const [imageApiBaseUrlValue, setImageApiBaseUrlValue] = useState(
    imageGeneration.apiBaseUrl
  );
  const [imageModelValue, setImageModelValue] = useState(imageGeneration.model);
  const [imageSizeValue, setImageSizeValue] = useState(imageGeneration.size);
  const [imageQualityValue, setImageQualityValue] = useState(
    imageGeneration.quality
  );
  const [imageOutputFormatValue, setImageOutputFormatValue] = useState(
    imageGeneration.outputFormat
  );
  const [imageTimeoutMsValue, setImageTimeoutMsValue] = useState(
    imageGeneration.timeoutMs
  );
  const [imageBlockchainPromptStyleValue, setImageBlockchainPromptStyleValue] =
    useState(imageGeneration.promptStyles.blockchain);
  const [imageAiPromptStyleValue, setImageAiPromptStyleValue] = useState(
    imageGeneration.promptStyles.ai
  );
  const [
    imageInfrastructurePromptStyleValue,
    setImageInfrastructurePromptStyleValue
  ] = useState(imageGeneration.promptStyles.infrastructure);

  const providerSubmit = useSettingsSubmit(
    providerAction,
    "provider",
    setState
  );
  const writingSubmit = useSettingsSubmit(writingAction, "writing", setState);
  const seoSubmit = useSettingsSubmit(seoStyleAction, "seo", setState);
  const imageSubmit = useSettingsSubmit(
    imageGenerationAction,
    "image",
    setState
  );

  const editingRole =
    writingRoles.find((role) => role.id === editingRoleId) ?? writingRoles[0];
  const imageKeyStatus = imageGeneration.hasApiKey
    ? `已单独配置（${imageGeneration.apiKeyPreview}）`
    : imageGeneration.canReuseTextApiKey && hasApiKey
      ? "未单独配置，将复用同供应商文本 Key"
      : "未单独配置，请填写图片 API Key";

  return (
    <div className="grid gap-5">
      <SectionShell
        icon={<KeyRound size={16} />}
        title="模型连接"
        description="文本生成模型连接配置会保存到数据库，用于写文章、翻译、SEO 和媒体元数据生成。"
        state={state.key === "provider" ? state : {}}
      >
        <div className="grid content-start gap-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            API Key 状态：{" "}
            <span className="font-medium text-slate-900">
              {hasApiKey ? `已配置（${apiKeyPreview}）` : "未配置"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-600">
              DeepSeek 使用 OpenAI-compatible Chat Completions。
            </p>
            <button
              type="button"
              className={buttonClassName("secondary")}
              onClick={() => {
                setApiBaseUrlValue(deepSeekBaseUrl);
                setModelValue(deepSeekModel);
              }}
            >
              <Sparkles size={16} />
              使用 DeepSeek
            </button>
          </div>
          <Field
            label="API Key"
            hint="留空会保留现有密钥。完整密钥会在服务端加密保存，不会完整显示。"
          >
            <input
              type="password"
              autoComplete="off"
              value={apiKeyValue}
              onChange={(event) => setApiKeyValue(event.target.value)}
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
          <div className="flex justify-end">
            <button
              type="button"
              disabled={providerSubmit.isPending}
              onClick={() =>
                providerSubmit.submit({
                  apiKey: apiKeyValue,
                  apiBaseUrl: apiBaseUrlValue,
                  model: modelValue,
                  timeoutMs: timeoutMsValue
                })
              }
              className={buttonClassName("primary")}
            >
              {providerSubmit.isPending ? "保存中..." : "保存文本模型"}
            </button>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<BookOpen size={16} />}
        title="写作策略"
        description="维护全局写作底线、默认写作角色，以及每个角色自己的差异化要求。"
        state={state.key === "writing" ? state : {}}
      >
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
            />
          </Field>
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
          <div className="grid gap-5 rounded-lg border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">角色风格</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                只维护角色差异，不重复全局底线。
              </p>
            </div>
            <Field label="编辑角色" hint={editingRole?.description}>
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
            {editingRole ? (
              <>
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
                <Field label={`${editingRole.label}写作要求`}>
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
              </>
            ) : null}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={writingSubmit.isPending}
              onClick={() =>
                writingSubmit.submit({
                  writingStyle: writingStyleValue,
                  defaultWritingRole: defaultWritingRoleValue,
                  writingRoleStyles: roleStyleValues
                })
              }
              className={buttonClassName("primary")}
            >
              {writingSubmit.isPending ? "保存中..." : "保存写作策略"}
            </button>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<Search size={16} />}
        title="AI SEO 策略"
        description="用于文章、分类、标签和首页的双语 SEO 生成。中文 SEO 和英文 SEO 分别服务对应前端入口。"
        state={state.key === "seo" ? state : {}}
      >
        <div className="grid gap-5">
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
          <div className="flex justify-end">
            <button
              type="button"
              disabled={seoSubmit.isPending}
              onClick={() =>
                seoSubmit.submit({
                  zhSeoStyle: zhSeoStyleValue,
                  enSeoStyle: enSeoStyleValue
                })
              }
              className={buttonClassName("primary")}
            >
              {seoSubmit.isPending ? "保存中..." : "保存 SEO 策略"}
            </button>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<ImageIcon size={16} />}
        title="封面生成"
        description="维护图片模型参数，以及区块链、人工智能、基础设施三类封面的视觉风格。"
        state={state.key === "image" ? state : {}}
      >
        <div className="grid gap-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            图片 API Key 状态：{" "}
            <span className="font-medium text-slate-900">
              {imageKeyStatus}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="图片 API Key"
              hint="留空会保留现有图片生成密钥。图片供应商与文本供应商不同时必须单独填写。"
            >
              <input
                type="password"
                autoComplete="off"
                value={imageApiKeyValue}
                onChange={(event) => setImageApiKeyValue(event.target.value)}
                className={inputClassName}
                placeholder={
                  imageGeneration.hasApiKey
                    ? "保留现有图片生成密钥"
                    : imageGeneration.canReuseTextApiKey
                      ? "可复用同供应商文本 Key 或填写 sk-..."
                      : "填写图片 API Key"
                }
              />
            </Field>
            <Field label="图片 API Base URL">
              <input
                type="url"
                value={imageApiBaseUrlValue}
                onChange={(event) => setImageApiBaseUrlValue(event.target.value)}
                className={inputClassName}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="图片模型">
              <input
                value={imageModelValue}
                onChange={(event) => setImageModelValue(event.target.value)}
                required
                className={inputClassName}
                placeholder="gpt-image-2"
              />
            </Field>
            <Field label="超时时间（毫秒）">
              <input
                type="number"
                min={10000}
                max={300000}
                step={1000}
                value={imageTimeoutMsValue}
                onChange={(event) => setImageTimeoutMsValue(event.target.value)}
                required
                className={inputClassName}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="尺寸">
              <select
                value={imageSizeValue}
                onChange={(event) => setImageSizeValue(event.target.value)}
                className={inputClassName}
              >
                <option value="auto">auto</option>
                <option value="1024x1024">1024x1024</option>
                <option value="1536x1024">1536x1024</option>
                <option value="1024x1536">1024x1536</option>
              </select>
            </Field>
            <Field label="质量">
              <select
                value={imageQualityValue}
                onChange={(event) => setImageQualityValue(event.target.value)}
                className={inputClassName}
              >
                <option value="auto">auto</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </Field>
            <Field label="输出格式">
              <select
                value={imageOutputFormatValue}
                onChange={(event) => setImageOutputFormatValue(event.target.value)}
                className={inputClassName}
              >
                <option value="png">png</option>
                <option value="jpeg">jpeg</option>
                <option value="webp">webp</option>
              </select>
            </Field>
          </div>
          <Field
            label="区块链封面风格"
            hint="用于区块链大类文章封面。提示词会自动附加当前文章标题、描述和所属大分类。"
          >
            <textarea
              value={imageBlockchainPromptStyleValue}
              onChange={(event) =>
                setImageBlockchainPromptStyleValue(event.target.value)
              }
              maxLength={2000}
              className={`${textareaClassName} min-h-32`}
            />
          </Field>
          <Field
            label="人工智能封面风格"
            hint="用于人工智能大类文章封面。提示词会自动附加当前文章标题、描述和所属大分类。"
          >
            <textarea
              value={imageAiPromptStyleValue}
              onChange={(event) => setImageAiPromptStyleValue(event.target.value)}
              maxLength={2000}
              className={`${textareaClassName} min-h-32`}
            />
          </Field>
          <Field
            label="基础设施封面风格"
            hint="用于基础设施大类文章封面。提示词会自动附加当前文章标题、描述和所属大分类。"
          >
            <textarea
              value={imageInfrastructurePromptStyleValue}
              onChange={(event) =>
                setImageInfrastructurePromptStyleValue(event.target.value)
              }
              maxLength={2000}
              className={`${textareaClassName} min-h-32`}
            />
          </Field>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={imageSubmit.isPending}
              onClick={() =>
                imageSubmit.submit({
                  apiKey: imageApiKeyValue,
                  apiBaseUrl: imageApiBaseUrlValue,
                  model: imageModelValue,
                  size: imageSizeValue,
                  quality: imageQualityValue,
                  outputFormat: imageOutputFormatValue,
                  timeoutMs: imageTimeoutMsValue,
                  blockchainPromptStyle: imageBlockchainPromptStyleValue,
                  aiPromptStyle: imageAiPromptStyleValue,
                  infrastructurePromptStyle: imageInfrastructurePromptStyleValue
                })
              }
              className={buttonClassName("primary")}
            >
              {imageSubmit.isPending ? "保存中..." : "保存封面生成"}
            </button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
