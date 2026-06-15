"use client";

import { useActionState } from "react";

import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
};

type MediaMetadata = {
  id: string;
  altText: string;
  caption: string;
  zhAltText: string;
  enAltText: string;
  zhSeoTitle: string;
  zhSeoDescription: string;
  enSeoTitle: string;
  enSeoDescription: string;
};

export function MediaMetadataForm({
  action,
  asset
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  asset: MediaMetadata;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PendingFieldset className="gap-5">
        <input type="hidden" name="id" value={asset.id} />
        <div>
          <h2 className="font-semibold text-slate-950">双语替代文本与 SEO</h2>
          <p className="mt-1 text-sm text-slate-500">
            这些信息用于媒体库检索、文章封面无障碍文本和图片 SEO。
          </p>
        </div>

        {state.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="grid gap-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-950">中文</h3>
            <Field label="中文替代文本">
              <input
                name="zhAltText"
                defaultValue={asset.zhAltText || asset.altText}
                maxLength={255}
                className={inputClassName}
              />
            </Field>
            <Field label="中文 SEO 标题">
              <input
                name="zhSeoTitle"
                defaultValue={asset.zhSeoTitle}
                maxLength={255}
                className={inputClassName}
              />
            </Field>
            <Field label="中文 SEO 描述">
              <textarea
                name="zhSeoDescription"
                defaultValue={asset.zhSeoDescription}
                maxLength={500}
                className={`${textareaClassName} min-h-32`}
              />
            </Field>
          </section>

          <section className="grid gap-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-950">English</h3>
            <Field label="English alt text">
              <input
                name="enAltText"
                defaultValue={asset.enAltText}
                maxLength={255}
                className={inputClassName}
              />
            </Field>
            <Field label="English SEO title">
              <input
                name="enSeoTitle"
                defaultValue={asset.enSeoTitle}
                maxLength={255}
                className={inputClassName}
              />
            </Field>
            <Field label="English SEO description">
              <textarea
                name="enSeoDescription"
                defaultValue={asset.enSeoDescription}
                maxLength={500}
                className={`${textareaClassName} min-h-32`}
              />
            </Field>
          </section>
        </div>

        <Field label="媒体库说明" hint="用于后台列表显示，建议保留中文。">
          <textarea
            name="caption"
            defaultValue={asset.caption}
            className={`${textareaClassName} min-h-24`}
          />
        </Field>

        <div className="flex justify-end">
          <SubmitButton>保存媒体信息</SubmitButton>
        </div>
      </PendingFieldset>
    </form>
  );
}
