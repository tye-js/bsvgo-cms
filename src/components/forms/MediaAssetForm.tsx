"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
};

export function MediaAssetForm({
  action
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [zhAltText, setZhAltText] = useState("");
  const [enAltText, setEnAltText] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    setUploadSuccess("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", zhAltText || enAltText);
      formData.append("caption", caption);
      formData.append("zhAltText", zhAltText);
      formData.append("enAltText", enAltText);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as {
        url?: string;
        altText?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        setUploadError(payload.error ?? "图片上传失败。");
        return;
      }

      setUrl(payload.url);
      setZhAltText(payload.altText ?? zhAltText);
      setUploadSuccess("图片上传成功，URL 已自动填入。");
    });
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <PendingFieldset className="grid gap-6 lg:contents">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-950">图片详情</h2>
          <p className="mt-1 text-sm text-slate-500">
            保存可复用的图片 URL，用于文章封面选择。
          </p>
        </div>
        {state.error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}
        <div className="grid gap-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(event) => uploadFile(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={isPending}
              className={buttonClassName("secondary")}
              onClick={() => fileInputRef.current?.click()}
            >
              {isPending ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : null}
              {isPending ? "上传中..." : "上传本地图片"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              支持上传 JPEG、PNG、WebP 或 AVIF，生成的 URL 会自动填入下方。
            </p>
            {uploadError ? (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {uploadError}
              </p>
            ) : null}
            {uploadSuccess ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {uploadSuccess}
              </p>
            ) : null}
          </div>

          <Field label="图片 URL">
            <input
              name="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              className={inputClassName}
              placeholder="https://..."
            />
          </Field>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="grid gap-4 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-950">中文信息</h3>
              <Field label="中文替代文本">
                <input
                  name="zhAltText"
                  value={zhAltText}
                  onChange={(event) => setZhAltText(event.target.value)}
                  maxLength={255}
                  className={inputClassName}
                />
              </Field>
              <Field label="中文 SEO 标题">
                <input name="zhSeoTitle" maxLength={255} className={inputClassName} />
              </Field>
              <Field label="中文 SEO 描述">
                <textarea
                  name="zhSeoDescription"
                  maxLength={500}
                  className={`${textareaClassName} min-h-28`}
                />
              </Field>
            </section>
            <section className="grid gap-4 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-950">English</h3>
              <Field label="English alt text">
                <input
                  name="enAltText"
                  value={enAltText}
                  onChange={(event) => setEnAltText(event.target.value)}
                  maxLength={255}
                  className={inputClassName}
                />
              </Field>
              <Field label="English SEO title">
                <input name="enSeoTitle" maxLength={255} className={inputClassName} />
              </Field>
              <Field label="English SEO description">
                <textarea
                  name="enSeoDescription"
                  maxLength={500}
                  className={`${textareaClassName} min-h-28`}
                />
              </Field>
            </section>
          </div>
          <Field label="图片说明">
            <textarea
              name="caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className={textareaClassName}
            />
          </Field>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-950">存储策略</h2>
          <p className="text-sm leading-6 text-slate-500">
            当前版本会把图片 URL 保存到 PostgreSQL，并通过媒体资源记录关联文章。
          </p>
        </section>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <SubmitButton className="flex-1">保存图片</SubmitButton>
          <Link href="/media" className={buttonClassName("secondary")}>
            取消
          </Link>
        </div>
      </aside>
      </PendingFieldset>
    </form>
  );
}
