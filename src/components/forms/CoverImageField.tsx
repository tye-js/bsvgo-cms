"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { POST_COVER_PLACEHOLDER_URL, coverImageUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type MediaAssetOption = {
  id: string;
  url: string;
  altText: string;
  caption: string;
  zhAltText: string;
  enAltText: string;
  zhSeoTitle: string;
  zhSeoDescription: string;
  enSeoTitle: string;
  enSeoDescription: string;
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
      return [
        asset.altText,
        asset.caption,
        asset.zhAltText,
        asset.enAltText,
        asset.zhSeoTitle,
        asset.zhSeoDescription,
        asset.enSeoTitle,
        asset.enSeoDescription,
        asset.url
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 24);

  function clearCover() {
    setAssetId("");
    setUrl("");
    setAltText("");
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
    setAltText(asset.zhAltText || asset.altText || asset.enAltText);
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
      formData.append("zhAltText", altText);

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
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={hasCover ? altText || "文章封面" : "文章封面占位图"}
          className={cn(
            "aspect-[16/9] w-full object-cover",
            !hasCover && previewUrl === POST_COVER_PLACEHOLDER_URL ? "opacity-90" : ""
          )}
        />
      </div>

      <input type="hidden" name="coverImageId" value={assetId} />
      <input type="hidden" name="coverImageUrl" value={url} />
      <input type="hidden" name="coverImageAlt" value={altText} />

      <div className="flex flex-wrap gap-2">
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
          className={buttonClassName("secondary", "min-h-9 px-3")}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={16} />
          {isPending ? "上传中..." : "上传"}
        </button>
        <button
          type="button"
          className={buttonClassName("ghost", "min-h-9 px-3")}
          onClick={clearCover}
        >
          <Trash2 size={14} />
          清除
        </button>
      </div>

      {mediaAssets.length ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">图库中选择</p>
            <p className="text-xs text-slate-500">显示前 24 个匹配结果</p>
          </div>
          <input
            value={assetQuery}
            onChange={(event) => setAssetQuery(event.target.value)}
            disabled={isPending}
            className={inputClassName}
            placeholder="搜索标题、替代文本、SEO 或 URL"
          />
          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={isPending}
                className={cn(
                  "group overflow-hidden rounded-md border bg-white text-left transition hover:border-slate-400",
                  asset.url === url
                    ? "border-slate-700 ring-2 ring-slate-200"
                    : "border-slate-200"
                )}
                onClick={() => chooseAsset(asset.id)}
                title={asset.zhAltText || asset.enAltText || asset.altText || asset.url}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.zhAltText || asset.altText || asset.enAltText}
                  className="aspect-[16/10] w-full object-cover"
                />
                <span className="grid gap-0.5 px-2 py-2">
                  <span className="truncate text-xs font-medium text-slate-800">
                    {asset.zhAltText || asset.altText || asset.zhSeoTitle || "未填写中文信息"}
                  </span>
                  <span className="truncate text-[11px] text-slate-500">
                    {asset.enAltText || asset.enSeoTitle || "No English metadata"}
                  </span>
                </span>
              </button>
            ))}
            {filteredAssets.length === 0 ? (
              <p className="col-span-2 px-2 py-6 text-center text-xs text-slate-500">
                没有匹配的图片。
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        {isPending ? (
          <p className="text-xs text-slate-500">
            图片上传中...
          </p>
        ) : null}
        {success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
