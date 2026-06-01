"use client";

import { useActionState, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

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

type DraftRewriteResult = {
  zh: {
    title: string;
    excerpt: string;
    content: string;
  };
  error?: string;
};

type DraftRewriteError = {
  error: string;
};

type DraftTranslationResult = {
  en: {
    title: string;
    excerpt: string;
    content: string;
  };
};

type DraftMetadataResult = {
  slug: string;
  zh: {
    seoTitle: string;
    seoDescription: string;
    structuredData: Record<string, unknown>;
  };
  en: {
    seoTitle: string;
    seoDescription: string;
    structuredData: Record<string, unknown>;
  };
};

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

export function PostForm({
  action,
  categories,
  tags,
  mediaAssets,
  post,
  submitLabel,
  generateEnglishFromChinese = false,
  writingRoles = [],
  defaultWritingRole = writingRoles[0]?.id ?? "technical_editor"
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
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const en = getTranslation(post, "en");
  const zh = getTranslation(post, "zh");
  const submitTimeoutMs = generateEnglishFromChinese ? 30000 : undefined;
  const [rawDraftInput, setRawDraftInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [writingRole, setWritingRole] = useState<AiWritingRoleId>(
    post?.aiAuthorRole ?? defaultWritingRole
  );
  const selectedWritingRole = writingRoles.find((role) => role.id === writingRole);
  const [draftRewriteError, setDraftRewriteError] = useState("");
  const [draftRewriteSuccess, setDraftRewriteSuccess] = useState("");
  const [draftTranslationError, setDraftTranslationError] = useState("");
  const [draftTranslationPending, setDraftTranslationPending] = useState(false);
  const [draftMetadataError, setDraftMetadataError] = useState("");
  const [draftMetadataPending, setDraftMetadataPending] = useState(false);
  const [isRewritingDraft, setIsRewritingDraft] = useState(false);
  const aiGenerationPending =
    isRewritingDraft || draftTranslationPending || draftMetadataPending;
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

  function syncDraftMetadata(payload: DraftMetadataResult) {
    setSlug(payload.slug);
    setZhSeoTitle(payload.zh.seoTitle);
    setZhSeoDescription(payload.zh.seoDescription);
    setZhStructuredData(structuredDataText(payload.zh.structuredData));
    setEnSeoTitle(payload.en.seoTitle);
    setEnSeoDescription(payload.en.seoDescription);
    setEnStructuredData(structuredDataText(payload.en.structuredData));
  }

  function syncTimeZoneFields() {
    setTimezoneOffset(String(new Date().getTimezoneOffset()));
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      setTimeZone("");
    }
  }

  function rewriteDraft() {
    setDraftRewriteError("");
    setDraftRewriteSuccess("");
    setDraftTranslationError("");
    setDraftMetadataError("");

    if (aiGenerationPending) return;

    void (async () => {
      setIsRewritingDraft(true);

      try {
        const response = await fetch("/api/posts/draft/rewrite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            writingRole,
            rawInput: rawDraftInput,
            sourceUrl
          })
        });
        const payload = await readJsonResponse<DraftRewriteResult>(
          response,
          "AI 改写文章失败。"
        );

        if ("error" in payload) {
          setDraftRewriteError(payload.error ?? "AI 改写文章失败。");
          return;
        }

        setZhTitle(payload.zh.title);
        setZhExcerpt(payload.zh.excerpt);
        setZhContent(payload.zh.content);
        setEnTitle("");
        setEnExcerpt("");
        setEnContent("");
        setSlug("");
        setZhSeoTitle("");
        setZhSeoDescription("");
        setEnSeoTitle("");
        setEnSeoDescription("");
        setDraftRewriteSuccess(
          "中文草稿已生成。英文稿和双语 SEO 正在后台生成。"
        );

        setDraftTranslationPending(true);
        setDraftMetadataPending(false);
        void (async () => {
          try {
            const translationResponse = await fetch("/api/posts/draft/translate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                writingRole,
                zhTitle: payload.zh.title,
                zhExcerpt: payload.zh.excerpt,
                zhContent: payload.zh.content
              })
            });
            const translationPayload = await readJsonResponse<DraftTranslationResult>(
              translationResponse,
              "英文稿自动生成失败。"
            );

            if ("error" in translationPayload) {
              setDraftTranslationError(
                translationPayload.error ?? "英文稿自动生成失败。"
              );
              return;
            }

            setEnTitle(translationPayload.en.title);
            setEnExcerpt(translationPayload.en.excerpt);
            setEnContent(translationPayload.en.content);
            setDraftRewriteSuccess("英文稿已生成，Slug 和双语 SEO 正在后台补齐。");

            setDraftMetadataPending(true);
            const metadataResponse = await fetch("/api/posts/draft/metadata", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                writingRole,
                zhTitle: payload.zh.title,
                zhExcerpt: payload.zh.excerpt,
                zhContent: payload.zh.content,
                enTitle: translationPayload.en.title,
                enExcerpt: translationPayload.en.excerpt,
                enContent: translationPayload.en.content
              })
            });
            const metadataPayload = await readJsonResponse<DraftMetadataResult>(
              metadataResponse,
              "Slug 和 SEO 自动生成失败。"
            );

            if ("error" in metadataPayload) {
              setDraftMetadataError(
                metadataPayload.error ?? "Slug 和 SEO 自动生成失败。"
              );
              return;
            }

            syncDraftMetadata(metadataPayload);
            setDraftRewriteSuccess(
              "中文草稿、英文稿、Slug 和双语 SEO 都已补齐，请检查后再提交。"
            );
          } catch (error) {
            setDraftTranslationError(
              error instanceof Error ? error.message : "英文稿自动生成失败。"
            );
          } finally {
            setDraftTranslationPending(false);
            setDraftMetadataPending(false);
          }
        })();
      } catch (error) {
        setDraftRewriteError(
          error instanceof Error ? error.message : "AI 改写文章失败。"
        );
      } finally {
        setIsRewritingDraft(false);
      }
    })();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={syncTimeZoneFields}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
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
              <h2 className="font-semibold text-slate-950">AI 写作助手</h2>
              <p className="mt-1 text-sm text-slate-500">
                先选择本篇文章的写作角色，再放入素材。AI 会按该角色生成中文稿，并继续生成英文稿、Slug 和双语 SEO。
              </p>
            </div>
            <div className="grid gap-4">
              {writingRoles.length ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Field
                    label="1. 选择本篇文章的 AI 角色"
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
                    角色会在点击生成时锁定，后续中文稿、英文稿和 SEO 会沿用同一个写作方向。
                  </p>
                  {selectedWritingRole ? (
                    <div className="mt-3 flex items-center gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                      <img
                        src={selectedWritingRole.avatar}
                        alt={selectedWritingRole.zhName}
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
              <Field label="未整理素材">
                <textarea
                  value={rawDraftInput}
                  onChange={(event) => setRawDraftInput(event.target.value)}
                  disabled={aiGenerationPending}
                  className={`${textareaClassName} min-h-52`}
                  placeholder="粘贴资料、灵感、链接、要点、碎片化笔记..."
                />
              </Field>
              {draftRewriteError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {draftRewriteError}
                </p>
              ) : null}
              {draftRewriteSuccess ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {draftRewriteSuccess}
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  aiGenerationPending ||
                  (!sourceUrl.trim() && rawDraftInput.trim().length < 20)
                }
                className={buttonClassName("secondary", "justify-self-start")}
                onClick={rewriteDraft}
              >
                {isRewritingDraft ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : (
                  <Sparkles size={16} />
                )}
                {isRewritingDraft ? "AI 正在生成中文..." : "按所选角色生成中英文文章"}
              </button>
              {draftTranslationPending ? (
                <p className="text-xs text-slate-500">英文稿正在后台生成...</p>
              ) : null}
              {draftTranslationError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {draftTranslationError}
                </p>
              ) : null}
              {draftMetadataPending ? (
                <p className="text-xs text-slate-500">Slug 和 SEO 正在后台生成...</p>
              ) : null}
              {draftMetadataError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {draftMetadataError}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

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
                disabled={draftTranslationPending}
                className={inputClassName}
              />
            </Field>
            <Field label="英文摘要">
              <textarea
                name="enExcerpt"
                value={enExcerpt}
                onChange={(event) => setEnExcerpt(event.target.value)}
                disabled={draftTranslationPending}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="enContent"
              label="英文正文"
              required={!generateEnglishFromChinese}
              value={enContent}
              onChange={setEnContent}
              disabled={draftTranslationPending}
            />
          </div>
        </section>
      </div>

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
                disabled={draftMetadataPending}
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
                disabled={draftMetadataPending}
                className={inputClassName}
              />
            </Field>
            <Field label="英文 SEO 描述">
              <textarea
                name="enSeoDescription"
                value={enSeoDescription}
                onChange={(event) => setEnSeoDescription(event.target.value)}
                maxLength={500}
                disabled={draftMetadataPending}
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
                disabled={draftMetadataPending}
                className={inputClassName}
              />
            </Field>
            <Field label="中文 SEO 描述">
              <textarea
                name="zhSeoDescription"
                value={zhSeoDescription}
                onChange={(event) => setZhSeoDescription(event.target.value)}
                maxLength={500}
                disabled={draftMetadataPending}
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
            >
              {submitLabel}
            </SubmitButton>
          </div>
          <a href="/posts" className={buttonClassName("secondary", "shrink-0")}>
            取消
          </a>
        </div>
      </aside>
      </PendingFieldset>
    </form>
  );
}
