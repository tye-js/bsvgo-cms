"use client";

import { useActionState, useEffect, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { SeoSuggestionOutput } from "@/server/ai/openai";

type HomepageSeoValue = {
  enTitle: string;
  enDescription: string;
  enKeywords: string;
  enOgTitle: string;
  enOgDescription: string;
  zhTitle: string;
  zhDescription: string;
  zhKeywords: string;
  zhOgTitle: string;
  zhOgDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

type SaveState = {
  error?: string;
  success?: string;
};

type GenerateState = SaveState & {
  suggestion?: SeoSuggestionOutput;
};

type LocalizedHomepageSeoKey = Exclude<
  keyof HomepageSeoValue,
  "ogImage" | "canonicalUrl"
>;

type LocalizedFieldsProps = {
  localeLabel: string;
  titleName: LocalizedHomepageSeoKey;
  descriptionName: LocalizedHomepageSeoKey;
  keywordsName: LocalizedHomepageSeoKey;
  ogTitleName: LocalizedHomepageSeoKey;
  ogDescriptionName: LocalizedHomepageSeoKey;
  titleHint: string;
  draft: HomepageSeoValue;
  onChange: (key: keyof HomepageSeoValue, value: string) => void;
};

function LocalizedHomepageSeoFields({
  localeLabel,
  titleName,
  descriptionName,
  keywordsName,
  ogTitleName,
  ogDescriptionName,
  titleHint,
  draft,
  onChange
}: LocalizedFieldsProps) {
  return (
    <section className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">{localeLabel}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{titleHint}</p>
      </div>
      <Field label={`${localeLabel} SEO 标题`}>
        <input
          name={titleName}
          value={draft[titleName]}
          onChange={(event) => onChange(titleName, event.target.value)}
          maxLength={255}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} SEO 描述`}>
        <textarea
          name={descriptionName}
          value={draft[descriptionName]}
          onChange={(event) => onChange(descriptionName, event.target.value)}
          maxLength={500}
          className={textareaClassName}
        />
      </Field>
      <Field label={`${localeLabel} SEO 关键词`}>
        <input
          name={keywordsName}
          value={draft[keywordsName]}
          onChange={(event) => onChange(keywordsName, event.target.value)}
          maxLength={500}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} Open Graph 标题`}>
        <input
          name={ogTitleName}
          value={draft[ogTitleName]}
          onChange={(event) => onChange(ogTitleName, event.target.value)}
          maxLength={255}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} Open Graph 描述`}>
        <textarea
          name={ogDescriptionName}
          value={draft[ogDescriptionName]}
          onChange={(event) => onChange(ogDescriptionName, event.target.value)}
          maxLength={500}
          className={textareaClassName}
        />
      </Field>
    </section>
  );
}

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
      enTitle: generateState.suggestion?.en.title ?? current.enTitle,
      enDescription:
        generateState.suggestion?.en.description ?? current.enDescription,
      enKeywords: generateState.suggestion?.en.keywords ?? current.enKeywords,
      enOgTitle: generateState.suggestion?.en.ogTitle ?? current.enOgTitle,
      enOgDescription:
        generateState.suggestion?.en.ogDescription ?? current.enOgDescription,
      zhTitle: generateState.suggestion?.zh.title ?? current.zhTitle,
      zhDescription:
        generateState.suggestion?.zh.description ?? current.zhDescription,
      zhKeywords: generateState.suggestion?.zh.keywords ?? current.zhKeywords,
      zhOgTitle: generateState.suggestion?.zh.ogTitle ?? current.zhOgTitle,
      zhOgDescription:
        generateState.suggestion?.zh.ogDescription ?? current.zhOgDescription
    }));
  }, [generateState.suggestion]);

  const updateDraft = (key: keyof HomepageSeoValue, nextValue: string) => {
    setDraft((current) => ({ ...current, [key]: nextValue }));
  };

  const hiddenFields = Object.entries(draft).map(([key, fieldValue]) => (
    <input key={key} type="hidden" name={key} value={fieldValue} />
  ));

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
        <div className="grid gap-4 lg:grid-cols-2">
          <LocalizedHomepageSeoFields
            localeLabel="英文首页"
            titleName="enTitle"
            descriptionName="enDescription"
            keywordsName="enKeywords"
            ogTitleName="enOgTitle"
            ogDescriptionName="enOgDescription"
            titleHint="对应前台英文首页入口，标题建议 45-60 个英文字符。"
            draft={draft}
            onChange={updateDraft}
          />
          <LocalizedHomepageSeoFields
            localeLabel="中文首页"
            titleName="zhTitle"
            descriptionName="zhDescription"
            keywordsName="zhKeywords"
            ogTitleName="zhOgTitle"
            ogDescriptionName="zhOgDescription"
            titleHint="对应前台中文首页入口，标题建议短、准、自然。"
            draft={draft}
            onChange={updateDraft}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Open Graph 图片 URL" hint="中英文首页共用的社交分享图片。">
            <input
              name="ogImage"
              type="url"
              value={draft.ogImage}
              onChange={(event) => updateDraft("ogImage", event.target.value)}
              className={inputClassName}
              placeholder="https://example.com/og-image.jpg"
            />
          </Field>
          <Field label="Canonical URL" hint="如前台中英文有独立 URL，可留空由前端按语言生成。">
            <input
              name="canonicalUrl"
              type="url"
              value={draft.canonicalUrl}
              onChange={(event) => updateDraft("canonicalUrl", event.target.value)}
              className={inputClassName}
              placeholder="https://example.com/"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <SubmitButton>保存双语首页 SEO</SubmitButton>
        </div>
      </form>

      <form action={generateFormAction}>
        {hiddenFields}
        <button type="submit" className={buttonClassName("secondary")}>
          用 AI 生成双语首页 SEO 建议
        </button>
      </form>
    </div>
  );
}
