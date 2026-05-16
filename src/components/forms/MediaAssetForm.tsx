"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
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
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isPending, startTransition] = useTransition();

  function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", altText);
      formData.append("caption", caption);

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
        setUploadError(payload.error ?? "Image upload failed.");
        return;
      }

      setUrl(payload.url);
      setAltText(payload.altText ?? altText);
    });
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-950">Image details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Store a reusable image URL for article covers. Upload storage can be added later.
          </p>
        </div>
        {state.error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
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
              {isPending ? "Uploading..." : "Upload local image"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Upload JPEG, PNG, WebP, or AVIF. The generated URL is filled below.
            </p>
            {uploadError ? (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {uploadError}
              </p>
            ) : null}
          </div>

          <Field label="Image URL">
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
          <Field label="Alt text">
            <input
              name="altText"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={255}
              className={inputClassName}
              placeholder="Describe the image for accessibility and SEO"
            />
          </Field>
          <Field label="Caption">
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
          <h2 className="mb-2 font-semibold text-slate-950">Storage policy</h2>
          <p className="text-sm leading-6 text-slate-500">
            Current version stores external image URLs in PostgreSQL and links posts through a media asset record.
          </p>
        </section>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <SubmitButton className="flex-1">Save image</SubmitButton>
          <a href="/media" className={buttonClassName("secondary")}>
            Cancel
          </a>
        </div>
      </aside>
    </form>
  );
}
