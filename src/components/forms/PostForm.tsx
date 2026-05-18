"use client";

import { useActionState, useRef, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { CoverImageField } from "@/components/forms/CoverImageField";
import { MarkdownEditor } from "@/components/forms/MarkdownEditor";
import { SeoSuggestionButton } from "@/components/forms/SeoSuggestionButton";
import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";
import type { Locale, PostStatus } from "@/server/db/schema";

type SelectOption = {
  id: string;
  slug: string;
  name: string;
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
};

function getTranslation(post: PostFormValue | undefined, locale: Locale) {
  return post?.translations.find((translation) => translation.locale === locale);
}

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
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
  const submitTimeoutMs = generateEnglishFromChinese ? 70000 : undefined;
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

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="grid gap-6">
        {state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
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
                defaultValue={zh?.title ?? ""}
                required={generateEnglishFromChinese}
                className={inputClassName}
              />
            </Field>
            <Field label="中文摘要">
              <textarea
                name="zhExcerpt"
                defaultValue={zh?.excerpt ?? ""}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="zhContent"
              label="中文正文"
              required={generateEnglishFromChinese}
              defaultValue={zh?.content ?? ""}
            />
          </div>
        </section>

        {generateEnglishFromChinese ? (
          <>
            <input type="hidden" name="enTitle" value="" />
            <input type="hidden" name="enExcerpt" value="" />
            <input type="hidden" name="enContent" value="" />
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">英文内容</h2>
              <p className="mt-1 text-sm text-slate-500">
                创建文章时会根据中文草稿生成英文标题、摘要、正文和 SEO 字段。
              </p>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-950">英文内容</h2>
              <p className="mt-1 text-sm text-slate-500">
                英文版本与同一篇文章记录关联。
              </p>
            </div>
            <div className="grid gap-4">
              <Field label="英文标题">
                <input
                  name="enTitle"
                  defaultValue={en?.title ?? ""}
                  required
                  className={inputClassName}
                />
              </Field>
              <Field label="英文摘要">
                <textarea
                  name="enExcerpt"
                  defaultValue={en?.excerpt ?? ""}
                  className={textareaClassName}
                />
              </Field>
              <MarkdownEditor
                name="enContent"
                label="英文正文"
                required
                defaultValue={en?.content ?? ""}
              />
            </div>
          </section>
        )}
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">发布设置</h2>
          <div className="grid gap-4">
            <Field label="Slug">
              <input
                name="slug"
                defaultValue={post?.slug ?? ""}
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
                {tag.name}
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
            <SubmitTimeoutNotice
              timeoutMs={submitTimeoutMs}
              message={
                generateEnglishFromChinese
                  ? "英文生成时间比预期更久。如果 AI 服务无法及时完成，请等待错误提示后再重新提交。"
                  : undefined
              }
            />
            <SubmitButton
              className="w-full"
              pendingLabel={generateEnglishFromChinese ? "正在生成英文..." : undefined}
              timeoutLabel={generateEnglishFromChinese ? "生成超时" : undefined}
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
    </form>
  );
}
