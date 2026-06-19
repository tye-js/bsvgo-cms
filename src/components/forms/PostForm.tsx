"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle
} from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { CoverImageField } from "@/components/forms/CoverImageField";
import { MarkdownEditor } from "@/components/forms/MarkdownEditor";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SeoSuggestionButton } from "@/components/forms/SeoSuggestionButton";
import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";
import type { AiWritingRoleId } from "@/lib/ai-style";
import type { Locale, PostStatus } from "@/server/db/schema";

type SelectOption = {
  id: string;
  slug: string;
  name?: string;
  enName?: string | null;
  zhName?: string | null;
};

type MediaAssetOption = {
  id: string;
  url: string;
  altText: string;
  caption: string;
  zhAltText: string;
  enAltText: string;
  zhSeoTitle: string;
  zhSeoDescription: string;
  enSeoTitle: string;
  enSeoDescription: string;
  storageProvider: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  createdAt: Date;
};

type WritingRoleOption = {
  id: AiWritingRoleId;
  label: string;
  zhName: string;
  enName: string;
  avatar: string;
  description: string;
};

type Translation = {
  locale: Locale;
  title: string;
  excerpt: string;
  content: string;
  readingMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
};

type PostFormValue = {
  slug: string;
  categoryId: string;
  status: PostStatus;
  aiAuthorRole: AiWritingRoleId | null;
  coverImageId: string | null;
  coverImageUrl: string | null;
  coverImageAlt?: string | null;
  enSeoTitle: string | null;
  enSeoDescription: string | null;
  enCanonicalUrl: string | null;
  enOgImage: string | null;
  enStructuredData: string | null;
  zhSeoTitle: string | null;
  zhSeoDescription: string | null;
  zhCanonicalUrl: string | null;
  zhOgImage: string | null;
  zhStructuredData: string | null;
  publishedAt: Date | null;
  featured: boolean;
  pinned: boolean;
  readingTimeMinutes: number;
  sortOrder: number;
  translations: Translation[];
  tagIds: string[];
};

type ActionState = {
  error?: string;
  success?: string;
};

type DraftRewriteError = {
  error: string;
};

type AiJobStatus = "queued" | "running" | "succeeded" | "failed";

type DraftCreateStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

type DraftCreateStepKey =
  | "source"
  | "chinese"
  | "english"
  | "metadata"
  | "database"
  | "cover";

type DraftCreateJobOutput = {
  postId?: string;
  postEditUrl?: string;
  coverJobId?: string;
  currentStep?: DraftCreateStepKey | "";
  message?: string;
  steps?: Array<{
    key: DraftCreateStepKey;
    label: string;
    status: DraftCreateStepStatus;
    message?: string;
  }>;
};

type AiJob<TOutput extends object> = {
  id: string;
  status: AiJobStatus;
  output: TOutput | null;
  error: string;
};

type AiJobResponse<TOutput extends object> = {
  job: AiJob<TOutput>;
};

const MAX_MARKDOWN_SOURCE_BYTES = 1024 * 1024;

const draftCreateStepDefinitions: Array<{
  key: DraftCreateStepKey;
  label: string;
}> = [
  { key: "source", label: "读取素材" },
  { key: "chinese", label: "生成中文稿" },
  { key: "english", label: "生成英文稿" },
  { key: "metadata", label: "生成 Slug 和 SEO" },
  { key: "database", label: "写入草稿" },
  { key: "cover", label: "排队生成封面" }
];

function structuredDataText(value: Record<string, unknown> | undefined) {
  if (!value || Object.keys(value).length === 0) return "{}";
  return JSON.stringify(value, null, 2);
}

function getTranslation(post: PostFormValue | undefined, locale: Locale) {
  return post?.translations.find((translation) => translation.locale === locale);
}

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

function optionLabel(option: SelectOption) {
  const enName = option.enName ?? option.name ?? option.slug;
  const zhName = option.zhName ?? "";
  return zhName && zhName !== enName ? `${enName} / ${zhName}` : enName;
}

async function readJsonResponse<T extends object>(
  response: Response,
  defaultError: string
): Promise<T | DraftRewriteError> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const trimmedText = text.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[");

  if (looksLikeJson) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return {
        error: "AI 返回了无法解析的结果，请稍后重试。"
      };
    }
  }

  let responsePath = "";
  try {
    responsePath = new URL(response.url).pathname;
  } catch {
    responsePath = "";
  }

  if (response.redirected && responsePath === "/login") {
    return {
      error: "登录状态已失效，请重新登录后再试。"
    };
  }

  if (response.redirected && responsePath === "/dashboard") {
    return {
      error: "当前账号没有权限执行这项操作。"
    };
  }

  if (response.status === 504 || /gateway timeout/i.test(trimmedText)) {
    return {
      error: "AI 生成超时了。可以缩短素材后再试，或稍后重试。"
    };
  }

  if (response.status === 502 || /bad gateway/i.test(trimmedText)) {
    return {
      error: "AI 服务暂时不可用，请稍后再试。"
    };
  }

  return {
    error:
      defaultError ||
      `请求失败（${response.status}）`
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createAiJob<TOutput extends object>(
  url: string,
  body: Record<string, unknown>,
  defaultError: string
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await readJsonResponse<AiJobResponse<TOutput>>(
    response,
    defaultError
  );

  if ("error" in payload) {
    throw new Error(payload.error || defaultError);
  }

  if (!payload.job?.id) {
    throw new Error(defaultError);
  }

  return payload.job;
}

async function readAiJob<TOutput extends object>(
  jobId: string,
  defaultError: string
) {
  const response = await fetch(`/api/ai/jobs/${jobId}`, {
    cache: "no-store"
  });
  const payload = await readJsonResponse<AiJobResponse<TOutput>>(
    response,
    defaultError
  );

  if ("error" in payload) {
    throw new Error(payload.error || defaultError);
  }

  return payload.job;
}

async function retryAiJob<TOutput extends object>(
  jobId: string,
  defaultError: string
) {
  const response = await fetch(`/api/ai/jobs/${jobId}`, {
    method: "POST"
  });
  const payload = await readJsonResponse<AiJobResponse<TOutput>>(
    response,
    defaultError
  );

  if ("error" in payload) {
    throw new Error(payload.error || defaultError);
  }

  return payload.job;
}

function draftCreateSteps(output: DraftCreateJobOutput | null | undefined) {
  const steps = output?.steps ?? [];
  return draftCreateStepDefinitions.map((definition) => {
    const current = steps.find((step) => step.key === definition.key);
    return {
      ...definition,
      status: current?.status ?? "pending",
      message: current?.message
    };
  });
}

function draftCreateProgress(output: DraftCreateJobOutput | null | undefined) {
  const steps = draftCreateSteps(output);
  const done = steps.filter(
    (step) => step.status === "succeeded" || step.status === "skipped"
  ).length;

  return Math.round((done / steps.length) * 100);
}

export function PostForm({
  action,
  categories,
  tags,
  mediaAssets,
  post,
  submitLabel,
  generateEnglishFromChinese = false,
  writingRoles = [],
  defaultWritingRole = writingRoles[0]?.id ?? "technical_editor",
  aiOnlyCreate = false
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  categories: SelectOption[];
  tags: SelectOption[];
  mediaAssets: MediaAssetOption[];
  post?: PostFormValue;
  submitLabel: string;
  generateEnglishFromChinese?: boolean;
  writingRoles?: WritingRoleOption[];
  defaultWritingRole?: AiWritingRoleId;
  aiOnlyCreate?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const en = getTranslation(post, "en");
  const zh = getTranslation(post, "zh");
  const submitTimeoutMs = generateEnglishFromChinese ? 30000 : undefined;
  const isAiDrivenCreate = generateEnglishFromChinese && aiOnlyCreate;
  const [rawDraftInput, setRawDraftInput] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFileError, setSourceFileError] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [writingRole, setWritingRole] = useState<AiWritingRoleId>(
    post?.aiAuthorRole ?? defaultWritingRole
  );
  const selectedWritingRole = writingRoles.find((role) => role.id === writingRole);
  const [draftCreateJob, setDraftCreateJob] =
    useState<AiJob<DraftCreateJobOutput> | null>(null);
  const [draftCreateError, setDraftCreateError] = useState("");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const aiGenerationPending =
    isCreatingDraft ||
    draftCreateJob?.status === "queued" ||
    draftCreateJob?.status === "running";
  const submittedWritingRole = generateEnglishFromChinese
    ? writingRole
    : (post?.aiAuthorRole ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [zhTitle, setZhTitle] = useState(zh?.title ?? "");
  const [zhExcerpt, setZhExcerpt] = useState(zh?.excerpt ?? "");
  const [zhContent, setZhContent] = useState(zh?.content ?? "");
  const [enTitle, setEnTitle] = useState(en?.title ?? "");
  const [enExcerpt, setEnExcerpt] = useState(en?.excerpt ?? "");
  const [enContent, setEnContent] = useState(en?.content ?? "");
  const [enSeoTitle, setEnSeoTitle] = useState(
    post?.enSeoTitle ?? en?.seoTitle ?? ""
  );
  const [enSeoDescription, setEnSeoDescription] = useState(
    post?.enSeoDescription ?? en?.seoDescription ?? ""
  );
  const [enCanonicalUrl, setEnCanonicalUrl] = useState(post?.enCanonicalUrl ?? "");
  const [enOgImage, setEnOgImage] = useState(post?.enOgImage ?? "");
  const [enStructuredData, setEnStructuredData] = useState(
    post?.enStructuredData ?? "{}"
  );
  const [zhSeoTitle, setZhSeoTitle] = useState(
    post?.zhSeoTitle ?? zh?.seoTitle ?? ""
  );
  const [zhSeoDescription, setZhSeoDescription] = useState(
    post?.zhSeoDescription ?? zh?.seoDescription ?? ""
  );
  const [zhCanonicalUrl, setZhCanonicalUrl] = useState(post?.zhCanonicalUrl ?? "");
  const [zhOgImage, setZhOgImage] = useState(post?.zhOgImage ?? "");
  const [zhStructuredData, setZhStructuredData] = useState(
    post?.zhStructuredData ?? "{}"
  );
  const [timezoneOffset, setTimezoneOffset] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const formValue = (name: string) =>
    formRef.current ? String(new FormData(formRef.current).get(name) ?? "") : "";
  const selectedCategoryId = () =>
    formRef.current ? String(new FormData(formRef.current).get("categoryId") ?? "") : "";
  const selectedTagIds = () =>
    formRef.current
      ? new FormData(formRef.current).getAll("tagIds").map(String).filter(Boolean)
      : [];

  function syncTimeZoneFields() {
    setTimezoneOffset(String(new Date().getTimezoneOffset()));
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      setTimeZone("");
    }
  }

  function importMarkdownFile(file: File | undefined) {
    setSourceFileError("");

    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isMarkdown =
      lowerName.endsWith(".md") || lowerName.endsWith(".markdown");

    if (!isMarkdown) {
      setSourceFileError("请上传 .md 或 .markdown 格式的 Markdown 文件。");
      return;
    }

    if (file.size <= 0) {
      setSourceFileError("Markdown 文件为空，请换一个文件。");
      return;
    }

    if (file.size > MAX_MARKDOWN_SOURCE_BYTES) {
      setSourceFileError("Markdown 文件不能超过 1MB。");
      return;
    }

    void file
      .text()
      .then((content) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
          setSourceFileError("Markdown 文件没有可读取的正文。");
          return;
        }

        setRawDraftInput(trimmedContent);
        setSourceFileName(file.name);
        setDraftCreateError("");
      })
      .catch(() => {
        setSourceFileError("Markdown 文件读取失败，请重新选择。");
      });
  }

  async function pollDraftCreateJob(initialJob: AiJob<DraftCreateJobOutput>) {
    let job = initialJob;
    setDraftCreateJob(job);

    for (let attempt = 0; attempt < 480; attempt += 1) {
      if (job.status === "succeeded" || job.status === "failed") return job;

      await wait(1500);
      job = await readAiJob<DraftCreateJobOutput>(
        job.id,
        "AI 文章生成任务状态读取失败。"
      );
      setDraftCreateJob(job);
    }

    setDraftCreateError("AI 任务仍在后台运行，进度已保存，可稍后刷新页面查看。");
    return job;
  }

  function createDraftPost() {
    setDraftCreateError("");

    if (aiGenerationPending) return;

    void (async () => {
      setIsCreatingDraft(true);

      try {
        const job = await createAiJob<DraftCreateJobOutput>(
          "/api/posts/draft/create",
          {
            writingRole,
            rawInput: rawDraftInput,
            sourceUrl,
            categoryId: selectedCategoryId(),
            tagIds: selectedTagIds()
          },
          "AI 创建文章草稿失败。"
        );
        const finishedJob = await pollDraftCreateJob(job);
        if (finishedJob.status === "failed") {
          setDraftCreateError(
            finishedJob.error || "AI 创建文章草稿失败，可点击继续生成。"
          );
        }
      } catch (error) {
        setDraftCreateError(
          error instanceof Error ? error.message : "AI 创建文章草稿失败。"
        );
      } finally {
        setIsCreatingDraft(false);
      }
    })();
  }

  function retryDraftCreate() {
    if (!draftCreateJob || aiGenerationPending) return;
    setDraftCreateError("");

    void (async () => {
      setIsCreatingDraft(true);
      try {
        const job = await retryAiJob<DraftCreateJobOutput>(
          draftCreateJob.id,
          "AI 文章生成任务继续失败。"
        );
        const finishedJob = await pollDraftCreateJob(job);
        if (finishedJob.status === "failed") {
          setDraftCreateError(
            finishedJob.error || "AI 创建文章草稿失败，可再次点击继续生成。"
          );
        }
      } catch (error) {
        setDraftCreateError(
          error instanceof Error ? error.message : "AI 文章生成任务继续失败。"
        );
      } finally {
        setIsCreatingDraft(false);
      }
    })();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        if (isAiDrivenCreate) {
          event.preventDefault();
          return;
        }

        syncTimeZoneFields();
      }}
      className={
        isAiDrivenCreate
          ? "mx-auto grid w-full max-w-5xl gap-6"
          : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      }
    >
      <input
        type="hidden"
        name="writingRole"
        value={submittedWritingRole}
      />
      <input
        type="hidden"
        name="publishedAtTimezoneOffset"
        value={timezoneOffset}
      />
      <input type="hidden" name="publishedAtTimeZone" value={timeZone} />
      <input type="hidden" name="mark" value="" />
      {isAiDrivenCreate ? (
        <input
          type="hidden"
          name="categoryId"
          value={post?.categoryId ?? categories[0]?.id ?? ""}
        />
      ) : null}
      <PendingFieldset className="grid gap-6 lg:contents">
      <div className="grid gap-6">
        {state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        {generateEnglishFromChinese ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-950">
                AI 改写生成文章
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                放入素材后，系统会生成中文稿、英文稿、Slug、双语 SEO，并写入草稿箱。
              </p>
            </div>
            <div className="grid gap-4">
              {writingRoles.length ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Field
                    label="写作角色"
                    hint={
                      selectedWritingRole?.description
                    }
                  >
                    <select
                      value={writingRole}
                      onChange={(event) =>
                        setWritingRole(event.target.value as AiWritingRoleId)
                      }
                      disabled={aiGenerationPending}
                      className={inputClassName}
                    >
                      {writingRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    生成时会锁定当前角色，后续英文稿和 SEO 沿用同一方向。
                  </p>
                  {selectedWritingRole ? (
                    <div className="mt-3 flex items-center gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                      <Image
                        src={selectedWritingRole.avatar}
                        alt={selectedWritingRole.zhName}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded-full bg-slate-100"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">
                          {selectedWritingRole.zhName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {selectedWritingRole.enName}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Field
                label="网页或视频链接"
                hint="可选。视频页会尽量抓取字幕，优先英文字幕或英文自动字幕；抓不到时会回退到网页标题、描述和可见文本。"
              >
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  disabled={aiGenerationPending}
                  className={inputClassName}
                  placeholder="https://..."
                />
              </Field>
              <Field
                label="Markdown 素材文件"
                hint="可选。支持 .md 和 .markdown，读取后会填入下方素材框，可继续编辑。"
              >
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  disabled={aiGenerationPending}
                  className={inputClassName}
                  onChange={(event) => importMarkdownFile(event.target.files?.[0])}
                />
              </Field>
              {sourceFileName ? (
                <p className="text-xs text-slate-500">
                  已导入：{sourceFileName}
                </p>
              ) : null}
              {sourceFileError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {sourceFileError}
                </p>
              ) : null}
              <Field label="未整理素材">
                <textarea
                  value={rawDraftInput}
                  onChange={(event) => setRawDraftInput(event.target.value)}
                  disabled={aiGenerationPending}
                  className={`${textareaClassName} min-h-52`}
                  placeholder="粘贴资料、灵感、链接、要点、碎片化笔记..."
                />
              </Field>
              {draftCreateJob ? (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">
                      生成进度 {draftCreateProgress(draftCreateJob.output)}%
                    </span>
                    <span className="text-slate-500">
                      {draftCreateJob.output?.message ||
                        (draftCreateJob.status === "queued"
                          ? "任务已提交，等待执行。"
                          : draftCreateJob.status === "running"
                            ? "AI 正在后台生成文章。"
                            : draftCreateJob.status === "succeeded"
                              ? "文章草稿已创建。"
                              : "任务失败，可继续生成。")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-700 transition-all"
                      style={{
                        width: `${draftCreateProgress(draftCreateJob.output)}%`
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    {draftCreateSteps(draftCreateJob.output).map((step) => (
                      <div
                        key={step.key}
                        className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                      >
                        {step.status === "succeeded" ? (
                          <CheckCircle2
                            size={16}
                            className="mt-0.5 text-emerald-600"
                          />
                        ) : step.status === "running" ? (
                          <Loader2
                            size={16}
                            className="mt-0.5 animate-spin text-slate-600"
                          />
                        ) : step.status === "failed" ? (
                          <XCircle size={16} className="mt-0.5 text-rose-600" />
                        ) : (
                          <Circle size={16} className="mt-0.5 text-slate-300" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{step.label}</p>
                          {step.message ? (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {step.message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {draftCreateJob.status === "succeeded" &&
                  draftCreateJob.output?.postEditUrl ? (
                    <a
                      href={draftCreateJob.output.postEditUrl}
                      className={buttonClassName("primary", "justify-self-start")}
                    >
                      打开草稿继续修改
                    </a>
                  ) : null}
                </div>
              ) : null}

              {draftCreateError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {draftCreateError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  aiGenerationPending ||
                  Boolean(draftCreateJob?.output?.postId) ||
                  (!sourceUrl.trim() && rawDraftInput.trim().length < 20)
                }
                className={buttonClassName("secondary", "justify-self-start")}
                onClick={createDraftPost}
              >
                {aiGenerationPending ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : (
                  <Sparkles size={16} />
                )}
                {aiGenerationPending ? "后台生成中..." : "生成中英文文章并创建草稿"}
              </button>

              {draftCreateJob?.status === "failed" ? (
                <button
                  type="button"
                  disabled={aiGenerationPending}
                  className={buttonClassName("secondary", "justify-self-start")}
                  onClick={retryDraftCreate}
                >
                  {aiGenerationPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  继续生成
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {isAiDrivenCreate ? null : (
          <>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">中文内容</h2>
            <p className="mt-1 text-sm text-slate-500">
              中文是源草稿。新建文章时可由 AI 自动生成英文版本。
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="中文标题">
              <input
                name="zhTitle"
                value={zhTitle}
                onChange={(event) => setZhTitle(event.target.value)}
                required={generateEnglishFromChinese}
                className={inputClassName}
              />
            </Field>
            <Field label="中文摘要">
              <textarea
                name="zhExcerpt"
                value={zhExcerpt}
                onChange={(event) => setZhExcerpt(event.target.value)}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="zhContent"
              label="中文正文"
              required={generateEnglishFromChinese}
              value={zhContent}
              onChange={setZhContent}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">英文内容</h2>
            <p className="mt-1 text-sm text-slate-500">
              英文版本与同一篇文章记录关联。新建时可由 AI 助手生成，也可手动填写。
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="英文标题">
              <input
                name="enTitle"
                value={enTitle}
                onChange={(event) => setEnTitle(event.target.value)}
                required={!generateEnglishFromChinese}
                disabled={aiGenerationPending}
                className={inputClassName}
              />
            </Field>
            <Field label="英文摘要">
              <textarea
                name="enExcerpt"
                value={enExcerpt}
                onChange={(event) => setEnExcerpt(event.target.value)}
                disabled={aiGenerationPending}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="enContent"
              label="英文正文"
              required={!generateEnglishFromChinese}
              value={enContent}
              onChange={setEnContent}
              disabled={aiGenerationPending}
            />
          </div>
        </section>
          </>
        )}
      </div>

      {isAiDrivenCreate ? null : (
      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">发布设置</h2>
          <div className="grid gap-4">
            <Field label="Slug">
              <input
                name="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required={!generateEnglishFromChinese}
                disabled={aiGenerationPending}
                className={inputClassName}
                placeholder="my-article-slug"
              />
            </Field>
            <Field label="状态">
              <select name="status" defaultValue={post?.status ?? "draft"} className={inputClassName}>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已归档</option>
              </select>
            </Field>
            <Field label="分类">
              <select
                name="categoryId"
                defaultValue={post?.categoryId ?? categories[0]?.id}
                required
                className={inputClassName}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="发布时间">
              <input
                name="publishedAt"
                type="datetime-local"
                defaultValue={toDateInputValue(post?.publishedAt)}
                className={inputClassName}
              />
              <p className="text-xs leading-5 text-slate-500">
                按你当前浏览器本地时间保存。提交时会同时记录浏览器时区偏移，再由服务端转换成统一时间，避免代理或服务器时区造成偏移。
              </p>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">标签</h2>
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={post?.tagIds.includes(tag.id) ?? false}
                  className="h-4 w-4 rounded border-slate-300 text-slate-700"
                />
                {optionLabel(tag)}
              </label>
            ))}
            {tags.length === 0 ? (
              <p className="text-sm text-slate-500">请先创建标签，再分配给文章。</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">SEO 与媒体</h2>
          <div className="grid gap-4">
            <CoverImageField
              defaultAssetId={post?.coverImageId ?? ""}
              defaultUrl={post?.coverImageUrl ?? ""}
              defaultAlt={post?.coverImageAlt ?? zh?.title ?? en?.title ?? ""}
              mediaAssets={mediaAssets}
            />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">英文页面 SEO</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                用于前台英文文章页的 title 和 meta description。
              </p>
            </div>
            <Field label="英文 SEO 标题">
              <input
                name="enSeoTitle"
                value={enSeoTitle}
                onChange={(event) => setEnSeoTitle(event.target.value)}
                disabled={aiGenerationPending}
                className={inputClassName}
              />
            </Field>
            <Field label="英文 SEO 描述">
              <textarea
                name="enSeoDescription"
                value={enSeoDescription}
                onChange={(event) => setEnSeoDescription(event.target.value)}
                maxLength={500}
                disabled={aiGenerationPending}
                className={textareaClassName}
              />
            </Field>
            <Field label="英文 canonical URL">
              <input
                name="enCanonicalUrl"
                type="url"
                value={enCanonicalUrl}
                onChange={(event) => setEnCanonicalUrl(event.target.value)}
                className={inputClassName}
                placeholder="https://www.bsvgo.com/en/..."
              />
            </Field>
            <Field label="英文 OG 图">
              <input
                name="enOgImage"
                type="url"
                value={enOgImage}
                onChange={(event) => setEnOgImage(event.target.value)}
                className={inputClassName}
                placeholder="https://www.bsvgo.com/media/og.jpg"
              />
            </Field>
            <Field
              label="英文结构化数据 JSON-LD"
              hint="给 Google 等搜索引擎读取的 Article/BlogPosting 结构化数据。用 AI 生成 SEO 时会自动补全，通常不需要手写。"
            >
              <textarea
                name="enStructuredData"
                value={enStructuredData}
                onChange={(event) => setEnStructuredData(event.target.value)}
                className={`${textareaClassName} font-mono text-xs`}
                placeholder='{"@context":"https://schema.org","@type":"Article"}'
              />
            </Field>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">中文页面 SEO</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                用于前台中文文章页的 title 和 meta description。
              </p>
            </div>
            <Field label="中文 SEO 标题">
              <input
                name="zhSeoTitle"
                value={zhSeoTitle}
                onChange={(event) => setZhSeoTitle(event.target.value)}
                disabled={aiGenerationPending}
                className={inputClassName}
              />
            </Field>
            <Field label="中文 SEO 描述">
              <textarea
                name="zhSeoDescription"
                value={zhSeoDescription}
                onChange={(event) => setZhSeoDescription(event.target.value)}
                maxLength={500}
                disabled={aiGenerationPending}
                className={textareaClassName}
              />
            </Field>
            <Field label="中文 canonical URL">
              <input
                name="zhCanonicalUrl"
                type="url"
                value={zhCanonicalUrl}
                onChange={(event) => setZhCanonicalUrl(event.target.value)}
                className={inputClassName}
                placeholder="https://www.bsvgo.com/zh/..."
              />
            </Field>
            <Field label="中文 OG 图">
              <input
                name="zhOgImage"
                type="url"
                value={zhOgImage}
                onChange={(event) => setZhOgImage(event.target.value)}
                className={inputClassName}
                placeholder="https://www.bsvgo.com/media/og.jpg"
              />
            </Field>
            <Field
              label="中文结构化数据 JSON-LD"
              hint="给 Google 等搜索引擎读取的 Article/BlogPosting 结构化数据。用 AI 生成 SEO 时会自动补全，通常不需要手写。"
            >
              <textarea
                name="zhStructuredData"
                value={zhStructuredData}
                onChange={(event) => setZhStructuredData(event.target.value)}
                className={`${textareaClassName} font-mono text-xs`}
                placeholder='{"@context":"https://schema.org","@type":"Article"}'
              />
            </Field>
            <SeoSuggestionButton
              targetType="post"
              sourceEnTitle={() => formValue("enTitle")}
              sourceEnDescription={() => formValue("enExcerpt") || enSeoDescription}
              sourceEnContent={() => formValue("enContent")}
              sourceZhTitle={() => formValue("zhTitle") || post?.slug || ""}
              sourceZhDescription={() => formValue("zhExcerpt") || zhSeoDescription}
              sourceZhContent={() => formValue("zhContent")}
              onApply={(suggestion) => {
                setEnSeoTitle(suggestion.en.title);
                setEnSeoDescription(suggestion.en.description);
                setEnStructuredData(structuredDataText(suggestion.en.structuredData));
                setZhSeoTitle(suggestion.zh.title);
                setZhSeoDescription(suggestion.zh.description);
                setZhStructuredData(structuredDataText(suggestion.zh.structuredData));
              }}
            />
            <div className="grid gap-3">
              <Field label="排序值">
                <input
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={post?.sortOrder ?? 0}
                  className={inputClassName}
                />
              </Field>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid flex-1 gap-2">
            {state.error ? (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
              >
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p
                role="status"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
              >
                {state.success}
              </p>
            ) : null}
            <SubmitTimeoutNotice
              timeoutMs={submitTimeoutMs}
              message={
                generateEnglishFromChinese
                  ? "创建文章时间比预期更久。如果服务器无法及时完成，请等待错误提示后再重新提交。"
                  : undefined
              }
            />
            <SubmitButton
              className="w-full"
              pendingLabel={generateEnglishFromChinese ? "正在创建文章..." : undefined}
              timeoutLabel={generateEnglishFromChinese ? "创建超时" : undefined}
              timeoutMs={submitTimeoutMs}
              disabled={generateEnglishFromChinese && Boolean(draftCreateJob?.output?.postId)}
            >
              {submitLabel}
            </SubmitButton>
          </div>
          <a href="/posts" className={buttonClassName("secondary", "shrink-0")}>
            取消
          </a>
        </div>
      </aside>
      )}
      </PendingFieldset>
    </form>
  );
}
