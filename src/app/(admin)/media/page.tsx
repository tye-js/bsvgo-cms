import Link from "next/link";
import { ImagePlus } from "lucide-react";

import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { CopyButton } from "@/components/admin/CopyButton";
import { inputClassName } from "@/components/admin/Field";
import { BulkCoverImageGenerationForm } from "@/components/forms/BulkCoverImageGenerationForm";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { formatDate } from "@/lib/utils";
import {
  bulkGeneratePostCoverImagesAction,
  deleteMediaAssetAction,
  deleteUnusedMediaAssetsAction
} from "@/server/media/actions";
import {
  getPostCoverGenerationOptions,
  listMediaAssets
} from "@/server/media/service";

function formatFileSize(size: number | null) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const providerFilters = ["all", "local", "external_url"] as const;
const usageFilters = ["all", "used", "unused"] as const;

export default async function MediaPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    provider?: string;
    usage?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const provider = providerFilters.includes(
    params.provider as (typeof providerFilters)[number]
  )
    ? (params.provider as (typeof providerFilters)[number])
    : "all";
  const usage = usageFilters.includes(params.usage as (typeof usageFilters)[number])
    ? (params.usage as (typeof usageFilters)[number])
    : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const [{ rows: assets, total, pageSize }, coverPostOptions] = await Promise.all([
    listMediaAssets({
      query: params.q,
      provider,
      usage,
      page
    }),
    getPostCoverGenerationOptions()
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (provider !== "all") search.set("provider", provider);
    if (usage !== "all") search.set("usage", usage);
    search.set("page", String(nextPage));
    return `/media?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">媒体库</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理文章封面使用的上传图片和外部图片。
          </p>
        </div>
        <ButtonLink href="/media/new" variant="primary">
          <ImagePlus size={17} />
          新建图片
        </ButtonLink>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          className={inputClassName}
          placeholder="搜索 URL、替代文本、说明或文件名"
        />
        <select name="provider" defaultValue={provider} className={inputClassName}>
          <option value="all">全部来源</option>
          <option value="local">已上传</option>
          <option value="external_url">外部 URL</option>
        </select>
        <select name="usage" defaultValue={usage} className={inputClassName}>
          <option value="all">全部使用状态</option>
          <option value="used">已使用</option>
          <option value="unused">未使用</option>
        </select>
        <input type="hidden" name="page" value="1" />
        <button type="submit" className={buttonClassName("secondary")}>
          搜索
        </button>
      </form>

      <BulkCoverImageGenerationForm
        action={bulkGeneratePostCoverImagesAction}
        posts={coverPostOptions}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <form id="bulk-delete-unused-media" action={deleteUnusedMediaAssetsAction} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            未使用图片指未作为任何未删除文章封面关联的媒体资源。
          </p>
          <ConfirmSubmitButton
            form="bulk-delete-unused-media"
            message="确定删除当前勾选的未使用图片吗？已使用图片会被自动跳过。"
            className="min-h-9 px-3"
          >
            批量删除未使用图片
          </ConfirmSubmitButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3 font-medium">选择</th>
                <th className="px-5 py-3 font-medium">预览</th>
                <th className="px-5 py-3 font-medium">替代文本 / SEO</th>
                <th className="px-5 py-3 font-medium">来源</th>
                <th className="px-5 py-3 font-medium">使用</th>
                <th className="px-5 py-3 font-medium">尺寸</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      name="ids"
                      value={asset.id}
                      form="bulk-delete-unused-media"
                      disabled={Number(asset.usageCount) > 0}
                      className="h-4 w-4 rounded border-slate-300 text-slate-700 disabled:opacity-40"
                    />
                  </td>
                  <td className="px-5 py-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.zhAltText || asset.altText || asset.enAltText}
                      className="h-14 w-24 rounded-md border border-slate-200 object-cover"
                    />
                  </td>
                  <td className="max-w-[220px] px-5 py-4 font-medium text-slate-900">
                    <Link
                      href={`/media/${asset.id}`}
                      className="hover:text-slate-600 hover:underline"
                    >
                      {asset.zhAltText || asset.altText || asset.originalFilename || "未命名图片"}
                    </Link>
                    {asset.enAltText ? (
                      <p className="mt-1 line-clamp-1 text-xs font-normal text-slate-500">
                        EN: {asset.enAltText}
                      </p>
                    ) : null}
                    {asset.caption ? (
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-slate-500">
                        {asset.caption}
                      </p>
                    ) : null}
                    {asset.zhSeoDescription || asset.enSeoDescription ? (
                      <p className="mt-1 line-clamp-2 text-[11px] font-normal text-slate-400">
                        SEO: {asset.zhSeoDescription || asset.enSeoDescription}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[300px] px-5 py-4 text-slate-500">
                    <span className="mb-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {asset.storageProvider === "local" ? "已上传" : "外部 URL"}
                    </span>
                    <span className="line-clamp-2 break-all">{asset.url}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {Number(asset.usageCount) > 0
                      ? `${asset.usageCount} 篇文章`
                      : "未使用"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    <span className="block">
                      {asset.width && asset.height ? `${asset.width} x ${asset.height}` : "-"}
                    </span>
                    <span className="text-xs">{formatFileSize(asset.fileSize)}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(asset.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <CopyButton
                        value={asset.url}
                        label="复制来源"
                        className="min-h-8 px-2"
                      />
                      <a
                        href={`/media/${asset.id}`}
                        className={buttonClassName("secondary", "min-h-8 px-2")}
                      >
                        详情
                      </a>
                      <form action={deleteMediaAssetAction}>
                        <input type="hidden" name="id" value={asset.id} />
                        <ConfirmSubmitButton
                          message="确定从媒体库删除这张图片吗？已有文章会保留当前封面 URL。"
                          className="min-h-8 px-2"
                        >
                          删除
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    没有找到匹配的媒体资源。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          第 {page} / {pageCount} 页，共 {total} 条
        </span>
        <div className="flex gap-2">
          <a
            className={buttonClassName(
              "secondary",
              page <= 1 ? "pointer-events-none opacity-50" : ""
            )}
            href={preserveParams(Math.max(page - 1, 1))}
          >
            上一页
          </a>
          <a
            className={buttonClassName(
              "secondary",
              page >= pageCount ? "pointer-events-none opacity-50" : ""
            )}
            href={preserveParams(Math.min(page + 1, pageCount))}
          >
            下一页
          </a>
        </div>
      </div>
    </div>
  );
}
