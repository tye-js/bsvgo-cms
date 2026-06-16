"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import type { SeoSuggestionOutput } from "@/server/ai/openai";
import type { HomepageSeoSettingsInput } from "@/server/settings/actions";

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

function StatusMessage({ state }: { state: SaveState }) {
  if (state.error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 size={16} />
        {state.success}
      </p>
    );
  }

  return null;
}

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
          value={draft[titleName]}
          onChange={(event) => onChange(titleName, event.target.value)}
          maxLength={255}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} SEO 描述`}>
        <textarea
          value={draft[descriptionName]}
          onChange={(event) => onChange(descriptionName, event.target.value)}
          maxLength={500}
          className={textareaClassName}
        />
      </Field>
      <Field label={`${localeLabel} SEO 关键词`}>
        <input
          value={draft[keywordsName]}
          onChange={(event) => onChange(keywordsName, event.target.value)}
          maxLength={500}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} Open Graph 标题`}>
        <input
          value={draft[ogTitleName]}
          onChange={(event) => onChange(ogTitleName, event.target.value)}
          maxLength={255}
          className={inputClassName}
        />
      </Field>
      <Field label={`${localeLabel} Open Graph 描述`}>
        <textarea
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
  saveAction,
  generateAction,
  value
}: {
  saveAction: (input: HomepageSeoSettingsInput) => Promise<SaveState>;
  generateAction: (input: HomepageSeoSettingsInput) => Promise<GenerateState>;
  value: HomepageSeoValue;
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>({});
  const [generateState, setGenerateState] = useState<GenerateState>({});
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [draft, setDraft] = useState(value);

  const applySuggestion = (suggestion: SeoSuggestionOutput) => {
    setDraft((current) => ({
      ...current,
      enTitle: suggestion.en.title ?? current.enTitle,
      enDescription: suggestion.en.description ?? current.enDescription,
      enKeywords: suggestion.en.keywords ?? current.enKeywords,
      enOgTitle: suggestion.en.ogTitle ?? current.enOgTitle,
      enOgDescription: suggestion.en.ogDescription ?? current.enOgDescription,
      zhTitle: suggestion.zh.title ?? current.zhTitle,
      zhDescription: suggestion.zh.description ?? current.zhDescription,
      zhKeywords: suggestion.zh.keywords ?? current.zhKeywords,
      zhOgTitle: suggestion.zh.ogTitle ?? current.zhOgTitle,
      zhOgDescription: suggestion.zh.ogDescription ?? current.zhOgDescription
    }));
  };

  const updateDraft = (key: keyof HomepageSeoValue, nextValue: string) => {
    setDraft((current) => ({ ...current, [key]: nextValue }));
  };

  const handleSave = () => {
    setSaveState({});
    setGenerateState({});
    startSaving(async () => {
      const nextState = await saveAction(draft);
      setSaveState(nextState);
      if (!nextState.error) {
        router.refresh();
      }
    });
  };

  const handleGenerate = () => {
    setSaveState({});
    setGenerateState({});
    startGenerating(async () => {
      const nextState = await generateAction(draft);
      setGenerateState(nextState);
      if (nextState.suggestion) {
        applySuggestion(nextState.suggestion);
      }
    });
  };

  return (
    <div className="grid gap-5">
      <StatusMessage state={saveState.error || saveState.success ? saveState : generateState} />

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
            type="url"
            value={draft.ogImage}
            onChange={(event) => updateDraft("ogImage", event.target.value)}
            className={inputClassName}
            placeholder="https://example.com/og-image.jpg"
          />
        </Field>
        <Field label="Canonical URL" hint="如前台中英文有独立 URL，可留空由前端按语言生成。">
          <input
            type="url"
            value={draft.canonicalUrl}
            onChange={(event) => updateDraft("canonicalUrl", event.target.value)}
            className={inputClassName}
            placeholder="https://example.com/"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className={buttonClassName("primary")}
        >
          {isSaving ? "保存中..." : "保存双语首页 SEO"}
        </button>
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerate}
          className={buttonClassName("secondary")}
        >
          {isGenerating ? "生成中..." : "用 AI 生成双语首页 SEO 建议"}
        </button>
      </div>
    </div>
  );
}
