"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { CoverImageField } from "@/components/forms/CoverImageField";
import { MarkdownEditor } from "@/components/forms/MarkdownEditor";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SeoSuggestionButton } from "@/components/forms/SeoSuggestionButton";
import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";
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
  coverImageId: string | null;
  coverImageUrl: string | null;
  coverImageAlt?: string | null;
  enSeoTitle: string | null;
  enSeoDescription: string | null;
  zhSeoTitle: string | null;
  zhSeoDescription: string | null;
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
  slug: string;
  zh: {
    title: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
  };
  en: {
    title: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
  };
  error?: string;
};

function getTranslation(post: PostFormValue | undefined, locale: Locale) {
  return post?.translations.find((translation) => translation.locale === locale);
}

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
}

function optionLabel(option: SelectOption) {
  const enName = option.enName ?? option.name ?? option.slug;
  const zhName = option.zhName ?? "";
  return zhName && zhName !== enName ? `${enName} / ${zhName}` : enName;
}

export function PostForm({
  action,
  categories,
  tags,
  mediaAssets,
  post,
  submitLabel,
  generateEnglishFromChinese = false
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
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const en = getTranslation(post, "en");
  const zh = getTranslation(post, "zh");
  const submitTimeoutMs = generateEnglishFromChinese ? 30000 : undefined;
  const [rawDraftInput, setRawDraftInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [draftRewriteError, setDraftRewriteError] = useState("");
  const [draftRewriteSuccess, setDraftRewriteSuccess] = useState("");
  const [isRewritingDraft, startDraftRewrite] = useTransition();
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
  const [zhSeoTitle, setZhSeoTitle] = useState(
    post?.zhSeoTitle ?? zh?.seoTitle ?? ""
  );
  const [zhSeoDescription, setZhSeoDescription] = useState(
    post?.zhSeoDescription ?? zh?.seoDescription ?? ""
  );
  const formValue = (name: string) =>
    formRef.current ? String(new FormData(formRef.current).get(name) ?? "") : "";

  function rewriteDraft() {
    setDraftRewriteError("");
    setDraftRewriteSuccess("");

    startDraftRewrite(async () => {
      const response = await fetch("/api/posts/draft/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawInput: rawDraftInput,
          sourceUrl
        })
      });
      const payload = (await response.json()) as DraftRewriteResult;

      if (!response.ok || payload.error) {
        setDraftRewriteError(payload.error ?? "AI 改写文章失败。");
        return;
      }

      setSlug(payload.slug);
      setZhTitle(payload.zh.title);
      setZhExcerpt(payload.zh.excerpt);
      setZhContent(payload.zh.content);
      setZhSeoTitle(payload.zh.seoTitle);
      setZhSeoDescription(payload.zh.seoDescription);
      setEnTitle(payload.en.title);
      setEnExcerpt(payload.en.excerpt);
      setEnContent(payload.en.content);
      setEnSeoTitle(payload.en.seoTitle);
      setEnSeoDescription(payload.en.seoDescription);
      setDraftRewriteSuccess("AI 已生成中英文草稿、Slug 和双语 SEO，请检查后再创建文章。");
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
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
                把未整理的信息、链接、要点或聊天记录放在这里，AI 会按设置页的写作风格生成中英文稿、Slug 和双语 SEO。
              </p>
            </div>
            <div className="grid gap-4">
              <Field
                label="网页或视频链接"
                hint="可选。视频页会尽量抓取字幕，优先英文字幕或英文自动字幕；抓不到时会回退到网页标题、描述和可见文本。"
              >
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  disabled={isRewritingDraft}
                  className={inputClassName}
                  placeholder="https://..."
                />
              </Field>
              <Field label="未整理素材">
                <textarea
                  value={rawDraftInput}
                  onChange={(event) => setRawDraftInput(event.target.value)}
                  disabled={isRewritingDraft}
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
                  isRewritingDraft ||
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
                {isRewritingDraft ? "AI 正在生成..." : "用 AI 生成中英文文章"}
              </button>
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
                className={inputClassName}
              />
            </Field>
            <Field label="英文摘要">
              <textarea
                name="enExcerpt"
                value={enExcerpt}
                onChange={(event) => setEnExcerpt(event.target.value)}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="enContent"
              label="英文正文"
              required={!generateEnglishFromChinese}
              value={enContent}
              onChange={setEnContent}
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
                required
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
            </Field>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={post?.featured ?? false}
                  className="h-4 w-4 rounded border-slate-300 text-slate-700"
                />
                精选文章
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="pinned"
                  defaultChecked={post?.pinned ?? false}
                  className="h-4 w-4 rounded border-slate-300 text-slate-700"
                />
                列表置顶
              </label>
            </div>
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
                className={inputClassName}
              />
            </Field>
            <Field label="英文 SEO 描述">
              <textarea
                name="enSeoDescription"
                value={enSeoDescription}
                onChange={(event) => setEnSeoDescription(event.target.value)}
                maxLength={500}
                className={textareaClassName}
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
                className={inputClassName}
              />
            </Field>
            <Field label="中文 SEO 描述">
              <textarea
                name="zhSeoDescription"
                value={zhSeoDescription}
                onChange={(event) => setZhSeoDescription(event.target.value)}
                maxLength={500}
                className={textareaClassName}
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
                setZhSeoTitle(suggestion.zh.title);
                setZhSeoDescription(suggestion.zh.description);
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="阅读分钟">
                <input
                  name="readingTimeMinutes"
                  type="number"
                  min={1}
                  defaultValue={post?.readingTimeMinutes ?? 5}
                  className={inputClassName}
                />
              </Field>
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
