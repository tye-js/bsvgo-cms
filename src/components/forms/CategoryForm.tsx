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

type CategoryFormValue = {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  translations: Translation[];
};

type ActionState = {
  error?: string;
};

function translation(category: CategoryFormValue, locale: Locale) {
  return category.translations.find((item) => item.locale === locale);
}

export function CategoryForm({
  category,
  action
}: {
  category: CategoryFormValue;
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const en = translation(category, "en");
  const zh = translation(category, "zh");
  const [enName, setEnName] = useState(en?.name ?? "");
  const [zhName, setZhName] = useState(zh?.name ?? "");
  const [enDescription, setEnDescription] = useState(en?.description ?? "");
  const [zhDescription, setZhDescription] = useState(zh?.description ?? "");
  const [seoTitle, setSeoTitle] = useState(category.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    category.seoDescription ?? ""
  );

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-950">分类内容</h2>
          <p className="mt-1 text-sm text-slate-500">
            主分类本身固定，描述和 SEO 字段可编辑。
          </p>
        </div>
        {state.error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-5">
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
                required
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
            <Field label="Slug">
              <input value={category.slug} readOnly className={`${inputClassName} bg-slate-50`} />
            </Field>
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
              targetType="category"
              sourceTitle={() => enName || zhName || category.slug}
              sourceDescription={() => enDescription || zhDescription || seoDescription}
              onApply={(suggestion) => {
                setSeoTitle(suggestion.title);
                setSeoDescription(suggestion.description);
              }}
            />
          </div>
        </section>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <SubmitButton className="flex-1">保存分类</SubmitButton>
          <a href="/categories" className={buttonClassName("secondary")}>
            取消
          </a>
        </div>
      </aside>
    </form>
  );
}
