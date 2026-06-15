"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { BookOpen, ImageIcon, KeyRound, Search } from "lucide-react";

import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { AiWritingRoleId } from "@/lib/ai-style";

type ActionState = {
  error?: string;
  success?: string;
};

type SettingsTab = "provider" | "writing" | "image" | "seo";

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
  enSeoStyle,
  imageGeneration
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
  imageGeneration: {
    hasApiKey: boolean;
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
  ] = useState(
    imageGeneration.promptStyles.infrastructure
  );
  const [editingRoleId, setEditingRoleId] = useState<AiWritingRoleId>(
    defaultWritingRole as AiWritingRoleId
  );
  const editingRole =
    writingRoles.find((role) => role.id === editingRoleId) ?? writingRoles[0];
  const tabs: Array<{
    id: SettingsTab;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "provider",
      label: "模型连接",
      description: "文本与图片模型的密钥、地址和超时",
      icon: <KeyRound size={16} />
    },
    {
      id: "writing",
      label: "写作策略",
      description: "全局底线、默认角色和角色风格",
      icon: <BookOpen size={16} />
    },
    {
      id: "image",
      label: "封面生成",
      description: "三类文章封面的模型参数和视觉风格",
      icon: <ImageIcon size={16} />
    },
    {
      id: "seo",
      label: "SEO 策略",
      description: "中文和英文 SEO 生成口径",
      icon: <Search size={16} />
    }
  ];
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

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
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <div className="px-3 py-3">
              <h2 className="text-sm font-semibold text-slate-950">AI 配置</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                按使用场景维护模型、写作、封面和 SEO 策略。
              </p>
            </div>
            <nav className="grid gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md px-3 py-3 text-left transition ${
                    activeTab === tab.id
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <span className="mt-0.5">{tab.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{tab.label}</span>
                    <span
                      className={`mt-0.5 block text-xs leading-5 ${
                        activeTab === tab.id ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {tab.description}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              {activeTabConfig.icon}
              {activeTabConfig.label}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {activeTabConfig.description}
            </p>
          </div>
          <input type="hidden" name="apiBaseUrl" value={apiBaseUrlValue} />
          <input type="hidden" name="model" value={modelValue} />
          <input type="hidden" name="timeoutMs" value={timeoutMsValue} />
          <input type="hidden" name="defaultWritingRole" value={defaultWritingRoleValue} />
          <textarea className="hidden" name="writingStyle" value={writingStyleValue} readOnly />
          <textarea className="hidden" name="zhSeoStyle" value={zhSeoStyleValue} readOnly />
          <textarea className="hidden" name="enSeoStyle" value={enSeoStyleValue} readOnly />
          <input type="hidden" name="imageApiBaseUrl" value={imageApiBaseUrlValue} />
          <input type="hidden" name="imageModel" value={imageModelValue} />
          <input type="hidden" name="imageSize" value={imageSizeValue} />
          <input type="hidden" name="imageQuality" value={imageQualityValue} />
          <input
            type="hidden"
            name="imageOutputFormat"
            value={imageOutputFormatValue}
          />
          <input type="hidden" name="imageTimeoutMs" value={imageTimeoutMsValue} />
          <textarea
            className="hidden"
            name="imageBlockchainPromptStyle"
            value={imageBlockchainPromptStyleValue}
            readOnly
          />
          <textarea
            className="hidden"
            name="imageAiPromptStyle"
            value={imageAiPromptStyleValue}
            readOnly
          />
          <textarea
            className="hidden"
            name="imageInfrastructurePromptStyle"
            value={imageInfrastructurePromptStyleValue}
            readOnly
          />
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
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="grid content-start gap-5 rounded-lg border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      文本生成
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      用于写文章、翻译、SEO、媒体元数据等文本任务。
                    </p>
                  </div>
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

                <div className="grid content-start gap-5 rounded-lg border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      图片生成
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      用于批量生成文章封面。未单独配置密钥时复用文本生成密钥。
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    API Key 状态：{" "}
                    <span className="font-medium text-slate-900">
                      {imageGeneration.hasApiKey
                        ? `已单独配置（${imageGeneration.apiKeyPreview}）`
                        : hasApiKey
                          ? "未单独配置，将复用文本生成 Key"
                          : "未配置"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm text-slate-600">
                      兼容 OpenAI Images API，模型名可直接填写 image2 / gpt-image-2。
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      onClick={() => {
                        setImageApiBaseUrlValue("https://api.openai.com/v1");
                        setImageModelValue("gpt-image-2");
                        setImageSizeValue("1536x1024");
                        setImageQualityValue("auto");
                        setImageOutputFormatValue("png");
                      }}
                    >
                      使用 OpenAI 生图
                    </button>
                  </div>

                  <Field
                    label="图片 API Key"
                    hint="留空会保留现有图片生成密钥；如果从未单独配置，会复用文本生成 API Key。"
                  >
                    <input
                      name="imageApiKey"
                      type="password"
                      autoComplete="off"
                      className={inputClassName}
                      placeholder={
                        imageGeneration.hasApiKey
                          ? "保留现有图片生成密钥"
                          : "复用文本生成 Key 或填写 sk-..."
                      }
                    />
                  </Field>

                  <Field label="图片 API Base URL">
                    <input
                      type="url"
                      value={imageApiBaseUrlValue}
                      onChange={(event) =>
                        setImageApiBaseUrlValue(event.target.value)
                      }
                      className={inputClassName}
                      placeholder="https://api.openai.com/v1"
                    />
                  </Field>

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
                        onChange={(event) =>
                          setImageTimeoutMsValue(event.target.value)
                        }
                        required
                        className={inputClassName}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "image" ? (
            <div className="grid gap-5">
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
                    onChange={(event) =>
                      setImageOutputFormatValue(event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="png">png</option>
                    <option value="jpeg">jpeg</option>
                    <option value="webp">webp</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4">
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
                    onChange={(event) =>
                      setImageAiPromptStyleValue(event.target.value)
                    }
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

              {editingRole ? (
                <div className="grid gap-5 rounded-lg border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      角色风格
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      只维护角色差异，不重复全局底线。
                    </p>
                  </div>
                  <Field label="编辑角色" hint={editingRole.description}>
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
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    建议明确：适合内容类型、开头方式、结构重点、语气、证据使用方式、营销或观点尺度。
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "seo" ? (
            <div className="grid gap-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">SEO 风格</h3>
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
        </div>

      <div className="flex justify-end">
        <SubmitButton>保存配置</SubmitButton>
      </div>
      </PendingFieldset>
    </form>
  );
}
