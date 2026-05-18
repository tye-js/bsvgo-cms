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
  defaultAssetId,
  defaultUrl,
  defaultAlt,
  mediaAssets
}: {
  defaultAssetId?: string | null;
  defaultUrl?: string | null;
  defaultAlt?: string | null;
  mediaAssets: MediaAssetOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [altText, setAltText] = useState(defaultAlt ?? "");
  const [caption, setCaption] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const previewUrl = coverImageUrl(url);
  const hasCover = Boolean(url.trim());
  const filteredAssets = mediaAssets
    .filter((asset) => {
      const query = assetQuery.trim().toLowerCase();
      if (!query) return true;
      return `${asset.altText} ${asset.caption} ${asset.url}`.toLowerCase().includes(query);
    })
    .slice(0, 24);

  function clearCover() {
    setAssetId("");
    setUrl("");
    setAltText("");
    setCaption("");
    setError("");
    setSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function chooseAsset(assetId: string) {
    const asset = mediaAssets.find((item) => item.id === assetId);
    if (!asset) return;
    setAssetId(asset.id);
    setUrl(asset.url);
    setAltText(asset.altText);
    setCaption(asset.caption);
    setError("");
    setSuccess("已选择媒体库图片。");
  }

  function uploadFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setSuccess("");

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
        setError(payload.error ?? "图片上传失败。");
        return;
      }

      setAssetId(payload.id);
      setUrl(payload.url);
      setAltText(payload.altText);
      setError("");
      setSuccess("封面上传成功，已自动填入文章。");
    });
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={hasCover ? altText || "文章封面" : "文章封面占位图"}
          className={cn(
            "aspect-[16/9] w-full object-cover",
            !hasCover && previewUrl === POST_COVER_PLACEHOLDER_URL ? "opacity-90" : ""
          )}
        />
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">
            {hasCover ? "已选择自定义封面" : "正在使用占位封面"}
          </p>
          <button
            type="button"
            className={buttonClassName("ghost", "min-h-8 px-2 text-xs")}
            onClick={clearCover}
          >
            <Trash2 size={14} />
            清除
          </button>
        </div>
      </div>

      <input type="hidden" name="coverImageId" value={assetId} />
      <input type="hidden" name="coverImageUrl" value={url} />
      <input type="hidden" name="coverImageAlt" value={altText} />

      <Field label="封面图片 URL" hint="可选。留空时文章会使用占位图。">
        <input
          type="url"
          value={url}
          onChange={(event) => {
            setAssetId("");
            setUrl(event.target.value);
          }}
          disabled={isPending}
          className={inputClassName}
          placeholder="https://..."
        />
      </Field>

      <Field label="替代文本" hint="未选择自定义封面时可留空。">
        <input
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          disabled={isPending}
          maxLength={255}
          className={inputClassName}
        />
      </Field>

      <Field label="图片说明">
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          disabled={isPending}
          className={textareaClassName}
        />
      </Field>

      {mediaAssets.length ? (
        <Field
          label="从媒体库选择"
          hint="适合图片较多的情况：先搜索，再点缩略图。当前显示前 24 个匹配结果。"
        >
          <div className="grid gap-3">
            <input
              value={assetQuery}
              onChange={(event) => setAssetQuery(event.target.value)}
              disabled={isPending}
              className={inputClassName}
              placeholder="搜索替代文本、说明或 URL"
            />
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  disabled={isPending}
                  className={cn(
                    "group overflow-hidden rounded-md border bg-white text-left transition hover:border-slate-400",
                    asset.url === url ? "border-slate-700 ring-2 ring-slate-200" : "border-slate-200"
                  )}
                  onClick={() => chooseAsset(asset.id)}
                  title={asset.altText || asset.url}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.altText}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block truncate px-2 py-1 text-[11px] text-slate-500">
                    {asset.altText || asset.url}
                  </span>
                </button>
              ))}
              {filteredAssets.length === 0 ? (
                <p className="col-span-3 px-2 py-6 text-center text-xs text-slate-500">
                  没有匹配的图片。
                </p>
              ) : null}
            </div>
          </div>
        </Field>
      ) : null}

      <div className="grid gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          disabled={isPending}
          onChange={(event) => uploadFile(event.target.files?.[0])}
        />
        <button
          type="button"
          disabled={isPending}
          className={buttonClassName("secondary")}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={16} />
          {isPending ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : null}
          {isPending ? "上传中..." : "上传封面"}
        </button>
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {success}
          </p>
        ) : null}
      </div>
    </div>
  );
}
