"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName, textareaClassName } from "@/components/admin/Field";
import { POST_COVER_PLACEHOLDER_URL, coverImageUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type MediaAssetOption = {
  id: string;
  url: string;
  altText: string;
  caption: string;
  storageProvider: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  createdAt: Date;
};

type UploadResponse = {
  id: string;
  url: string;
  altText: string;
  error?: string;
};

export function CoverImageField({
  defaultUrl,
  defaultAlt,
  mediaAssets
}: {
  defaultUrl?: string | null;
  defaultAlt?: string | null;
  mediaAssets: MediaAssetOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [altText, setAltText] = useState(defaultAlt ?? "");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const previewUrl = coverImageUrl(url);
  const hasCover = Boolean(url.trim());

  function clearCover() {
    setUrl("");
    setAltText("");
    setCaption("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function chooseAsset(assetId: string) {
    const asset = mediaAssets.find((item) => item.id === assetId);
    if (!asset) return;
    setUrl(asset.url);
    setAltText(asset.altText);
    setCaption(asset.caption);
    setError("");
  }

  function uploadFile(file: File | undefined) {
    if (!file) return;
    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", altText);
      formData.append("caption", caption);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok) {
        setError(payload.error ?? "Image upload failed.");
        return;
      }

      setUrl(payload.url);
      setAltText(payload.altText);
      setError("");
    });
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={hasCover ? altText || "Post cover" : "Post cover placeholder"}
          className={cn(
            "aspect-[16/9] w-full object-cover",
            !hasCover && previewUrl === POST_COVER_PLACEHOLDER_URL ? "opacity-90" : ""
          )}
        />
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">
            {hasCover ? "Custom cover selected" : "Using placeholder cover"}
          </p>
          <button
            type="button"
            className={buttonClassName("ghost", "min-h-8 px-2 text-xs")}
            onClick={clearCover}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      <input type="hidden" name="coverImageUrl" value={url} />
      <input type="hidden" name="coverImageAlt" value={altText} />

      <Field label="Cover image URL" hint="Optional. Empty posts use the placeholder image.">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className={inputClassName}
          placeholder="https://..."
        />
      </Field>

      <Field label="Alt text" hint="Optional when no custom cover is selected.">
        <input
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          maxLength={255}
          className={inputClassName}
        />
      </Field>

      <Field label="Caption">
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className={textareaClassName}
        />
      </Field>

      {mediaAssets.length ? (
        <Field label="Choose from media">
          <select
            className={inputClassName}
            value=""
            onChange={(event) => chooseAsset(event.target.value)}
          >
            <option value="">Select an existing image</option>
            {mediaAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.altText || asset.url}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid gap-2">
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
          <ImagePlus size={16} />
          {isPending ? "Uploading..." : "Upload cover"}
        </button>
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
