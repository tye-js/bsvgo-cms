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
};

type TagFormValue = {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
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
  const [seoTitle, setSeoTitle] = useState(tag?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(tag?.seoDescription ?? "");

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
            <Field label="SEO 标题">
              <input
                name="seoTitle"
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="SEO 描述">
              <textarea
                name="seoDescription"
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
                className={textareaClassName}
              />
            </Field>
            <SeoSuggestionButton
              targetType="tag"
              sourceTitle={() => enName || zhName || slug}
              sourceDescription={() => enDescription || zhDescription || seoDescription}
              onApply={(suggestion) => {
                setSeoTitle(suggestion.title);
                setSeoDescription(suggestion.description);
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
