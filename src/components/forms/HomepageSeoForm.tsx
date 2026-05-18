"use client";

import { useActionState, useEffect, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";

type HomepageSeoValue = {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

type SaveState = {
  error?: string;
  success?: string;
};

type GenerateState = SaveState & {
  suggestion?: {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
  };
};

export function HomepageSeoForm({
  action,
  generateAction,
  value
}: {
  action: (previousState: SaveState, formData: FormData) => Promise<SaveState>;
  generateAction: (
    previousState: GenerateState,
    formData: FormData
  ) => Promise<GenerateState>;
  value: HomepageSeoValue;
}) {
  const [saveState, saveAction] = useActionState(action, {});
  const [generateState, generateFormAction] = useActionState(generateAction, {});
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!generateState.suggestion) return;

    setDraft((current) => ({
      ...current,
      title: generateState.suggestion?.title ?? current.title,
      description: generateState.suggestion?.description ?? current.description,
      keywords: generateState.suggestion?.keywords ?? current.keywords,
      ogTitle: generateState.suggestion?.ogTitle ?? current.ogTitle,
      ogDescription:
        generateState.suggestion?.ogDescription ?? current.ogDescription
    }));
  }, [generateState.suggestion]);

  const hiddenFields = (
    <>
      <input type="hidden" name="title" value={draft.title} />
      <input type="hidden" name="description" value={draft.description} />
      <input type="hidden" name="keywords" value={draft.keywords} />
      <input type="hidden" name="ogTitle" value={draft.ogTitle} />
      <input type="hidden" name="ogDescription" value={draft.ogDescription} />
      <input type="hidden" name="ogImage" value={draft.ogImage} />
      <input type="hidden" name="canonicalUrl" value={draft.canonicalUrl} />
    </>
  );

  return (
    <div className="grid gap-5">
      {saveState.error || generateState.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {saveState.error ?? generateState.error}
        </p>
      ) : null}
      {saveState.success || generateState.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {saveState.success ?? generateState.success}
        </p>
      ) : null}

      <form action={saveAction} className="grid gap-5">
        <Field label="首页 SEO 标题" hint="建议 45-60 个英文字符。">
          <input
            name="title"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            required
            maxLength={255}
            className={inputClassName}
          />
        </Field>

        <Field label="首页 SEO 描述" hint="建议 120-160 个英文字符。">
          <textarea
            name="description"
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value
              }))
            }
            required
            maxLength={500}
            className={textareaClassName}
          />
        </Field>

        <Field label="SEO 关键词" hint="用英文逗号分隔，供前台或元数据使用。">
          <input
            name="keywords"
            value={draft.keywords}
            onChange={(event) =>
              setDraft((current) => ({ ...current, keywords: event.target.value }))
            }
            maxLength={500}
            className={inputClassName}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Open Graph 标题">
            <input
              name="ogTitle"
              value={draft.ogTitle}
              onChange={(event) =>
                setDraft((current) => ({ ...current, ogTitle: event.target.value }))
              }
              maxLength={255}
              className={inputClassName}
            />
          </Field>
          <Field label="Canonical URL">
            <input
              name="canonicalUrl"
              type="url"
              value={draft.canonicalUrl}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  canonicalUrl: event.target.value
                }))
              }
              className={inputClassName}
              placeholder="https://example.com/"
            />
          </Field>
        </div>

        <Field label="Open Graph 描述">
          <textarea
            name="ogDescription"
            value={draft.ogDescription}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ogDescription: event.target.value
              }))
            }
            maxLength={500}
            className={textareaClassName}
          />
        </Field>

        <Field label="Open Graph 图片 URL">
          <input
            name="ogImage"
            type="url"
            value={draft.ogImage}
            onChange={(event) =>
              setDraft((current) => ({ ...current, ogImage: event.target.value }))
            }
            className={inputClassName}
            placeholder="https://example.com/og-image.jpg"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <SubmitButton>保存首页 SEO</SubmitButton>
        </div>
      </form>

      <form action={generateFormAction}>
        {hiddenFields}
        <button type="submit" className={buttonClassName("secondary")}>
          用 AI 生成首页 SEO 建议
        </button>
      </form>
    </div>
  );
}
