"use client";

import { useActionState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
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

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-950">Tag details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tags drive filtering and automatic article recommendations.
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
              defaultValue={tag?.slug ?? ""}
              required
              className={inputClassName}
              placeholder="bitcoin-sv"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="English name">
              <input
                name="enName"
                defaultValue={en?.name ?? ""}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="Chinese name">
              <input name="zhName" defaultValue={zh?.name ?? ""} className={inputClassName} />
            </Field>
          </div>
          <Field label="English description">
            <textarea
              name="enDescription"
              defaultValue={en?.description ?? ""}
              className={textareaClassName}
            />
          </Field>
          <Field label="Chinese description">
            <textarea
              name="zhDescription"
              defaultValue={zh?.description ?? ""}
              className={textareaClassName}
            />
          </Field>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">SEO</h2>
          <div className="grid gap-4">
            <Field label="SEO title">
              <input
                name="seoTitle"
                defaultValue={tag?.seoTitle ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="SEO description">
              <textarea
                name="seoDescription"
                defaultValue={tag?.seoDescription ?? ""}
                className={textareaClassName}
              />
            </Field>
          </div>
        </section>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <SubmitButton className="flex-1">{submitLabel}</SubmitButton>
          <a href="/tags" className={buttonClassName("secondary")}>
            Cancel
          </a>
        </div>
      </aside>
    </form>
  );
}
