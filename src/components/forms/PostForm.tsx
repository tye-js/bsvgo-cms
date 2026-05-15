"use client";

import { useActionState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { MarkdownEditor } from "@/components/forms/MarkdownEditor";
import { SubmitButton, SubmitTimeoutNotice } from "@/components/forms/SubmitButton";
import type { Locale, PostStatus } from "@/server/db/schema";

type SelectOption = {
  id: string;
  slug: string;
  name: string;
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
  seoTitle: string | null;
  seoDescription: string | null;
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
  post,
  submitLabel
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  categories: SelectOption[];
  tags: SelectOption[];
  post?: PostFormValue;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const en = getTranslation(post, "en");
  const zh = getTranslation(post, "zh");

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        {state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">English content</h2>
            <p className="mt-1 text-sm text-slate-500">
              English is the primary source for BSVgo articles.
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="Title">
              <input
                name="enTitle"
                defaultValue={en?.title ?? ""}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="Excerpt">
              <textarea
                name="enExcerpt"
                defaultValue={en?.excerpt ?? ""}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor
              name="enContent"
              label="Body"
              required
              defaultValue={en?.content ?? ""}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">Chinese content</h2>
            <p className="mt-1 text-sm text-slate-500">
              Optional translation linked to the same article record.
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="中文标题">
              <input name="zhTitle" defaultValue={zh?.title ?? ""} className={inputClassName} />
            </Field>
            <Field label="中文摘要">
              <textarea
                name="zhExcerpt"
                defaultValue={zh?.excerpt ?? ""}
                className={textareaClassName}
              />
            </Field>
            <MarkdownEditor name="zhContent" label="中文正文" defaultValue={zh?.content ?? ""} />
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">Publishing</h2>
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
            <Field label="Status">
              <select name="status" defaultValue={post?.status ?? "draft"} className={inputClassName}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Category">
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
            <Field label="Published at">
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
                Featured article
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="pinned"
                  defaultChecked={post?.pinned ?? false}
                  className="h-4 w-4 rounded border-slate-300 text-slate-700"
                />
                Pinned in lists
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">Tags</h2>
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
              <p className="text-sm text-slate-500">Create tags before assigning them.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">SEO and media</h2>
          <div className="grid gap-4">
            <Field label="Cover image URL" hint="Upload is intentionally not included in v1.">
              <input
                name="coverImageUrl"
                type="url"
                defaultValue={post?.coverImageUrl ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="SEO title">
              <input
                name="seoTitle"
                defaultValue={post?.seoTitle ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="SEO description">
              <textarea
                name="seoDescription"
                defaultValue={post?.seoDescription ?? ""}
                className={textareaClassName}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Read min">
                <input
                  name="readingTimeMinutes"
                  type="number"
                  min={1}
                  defaultValue={post?.readingTimeMinutes ?? 5}
                  className={inputClassName}
                />
              </Field>
              <Field label="Sort order">
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
            <SubmitTimeoutNotice />
            <SubmitButton className="w-full">{submitLabel}</SubmitButton>
          </div>
          <a href="/posts" className={buttonClassName("secondary", "shrink-0")}>
            Cancel
          </a>
        </div>
      </aside>
    </form>
  );
}
