"use client";

import { useActionState, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { SeoSuggestionButton } from "@/components/forms/SeoSuggestionButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { Locale } from "@/server/db/schema";

type Translation = {
  locale: Locale;
  name: string;
  description: string | null;
  seoTitle?: string;
  seoDescription?: string;
};

type TagFormValue = {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  enSeoTitle?: string | null;
  enSeoDescription?: string | null;
  zhSeoTitle?: string | null;
  zhSeoDescription?: string | null;
  translations: Translation[];
};

type ActionState = {
  error?: string;
};

function translation(tag: TagFormValue | undefined, locale: Locale) {
  return tag?.translations.find((item) => item.locale === locale);
}

export function TagForm({
  tag,
  action,
  submitLabel
}: {
  tag?: TagFormValue;
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const en = translation(tag, "en");
  const zh = translation(tag, "zh");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [enName, setEnName] = useState(en?.name ?? "");
  const [zhName, setZhName] = useState(zh?.name ?? "");
  const [enDescription, setEnDescription] = useState(en?.description ?? "");
  const [zhDescription, setZhDescription] = useState(zh?.description ?? "");
  const [enSeoTitle, setEnSeoTitle] = useState(
    tag?.enSeoTitle ?? en?.seoTitle ?? tag?.seoTitle ?? ""
  );
  const [enSeoDescription, setEnSeoDescription] = useState(
    tag?.enSeoDescription ?? en?.seoDescription ?? tag?.seoDescription ?? ""
  );
  const [zhSeoTitle, setZhSeoTitle] = useState(
    tag?.zhSeoTitle ?? zh?.seoTitle ?? ""
  );
  const [zhSeoDescription, setZhSeoDescription] = useState(
    tag?.zhSeoDescription ?? zh?.seoDescription ?? ""
  );

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-950">标签详情</h2>
          <p className="mt-1 text-sm text-slate-500">
            标签用于筛选和自动推荐相关文章。
          </p>
        </div>
        {state.error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-5">
          <Field label="Slug">
            <input
              name="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
              className={inputClassName}
              placeholder="bitcoin-sv"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="英文名称">
              <input
                name="enName"
                value={enName}
                onChange={(event) => setEnName(event.target.value)}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="中文名称">
              <input
                name="zhName"
                value={zhName}
                onChange={(event) => setZhName(event.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>
          <Field label="英文描述">
            <textarea
              name="enDescription"
              value={enDescription}
              onChange={(event) => setEnDescription(event.target.value)}
              className={textareaClassName}
            />
          </Field>
          <Field label="中文描述">
            <textarea
              name="zhDescription"
              value={zhDescription}
              onChange={(event) => setZhDescription(event.target.value)}
              className={textareaClassName}
            />
          </Field>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">SEO</h2>
          <div className="grid gap-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">英文标签页 SEO</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                对应前台英文标签入口。
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
              <p className="text-sm font-semibold text-slate-800">中文标签页 SEO</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                对应前台中文标签入口。
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
              targetType="tag"
              sourceEnTitle={() => enName || slug}
              sourceEnDescription={() => enDescription || enSeoDescription}
              sourceZhTitle={() => zhName || enName || slug}
              sourceZhDescription={() => zhDescription || zhSeoDescription}
              onApply={(suggestion) => {
                setEnSeoTitle(suggestion.en.title);
                setEnSeoDescription(suggestion.en.description);
                setZhSeoTitle(suggestion.zh.title);
                setZhSeoDescription(suggestion.zh.description);
              }}
            />
          </div>
        </section>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <SubmitButton className="flex-1">{submitLabel}</SubmitButton>
          <a href="/tags" className={buttonClassName("secondary")}>
            取消
          </a>
        </div>
      </aside>
    </form>
  );
}
