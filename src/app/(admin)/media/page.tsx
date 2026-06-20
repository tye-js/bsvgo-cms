import Link from "next/link";
import { Grid3X3, Images, ImagePlus, List } from "lucide-react";

import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { CopyButton } from "@/components/admin/CopyButton";
import { DetailDrawer, FilterBar, InfoList, StickyActionBar, WideTable } from "@/components/admin/DataLayout";
import { inputClassName } from "@/components/admin/Field";
import { MetricStrip, MetricTile, PageHeader } from "@/components/admin/PageHeader";
import { BulkMediaMetadataForm } from "@/components/forms/BulkMediaMetadataForm";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { cn, formatDate } from "@/lib/utils";
import {
  bulkGenerateMediaMetadataAction,
  deleteMediaAssetAction,
  deleteUnusedMediaAssetsAction
} from "@/server/media/actions";
import { listMediaAssets } from "@/server/media/service";

function formatFileSize(size: number | null) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const providerFilters = ["all", "local", "external_url"] as const;
const usageFilters = ["all", "used", "unused"] as const;
const needsFilters = [
  "all",
  "missing_zh_alt",
  "missing_en_seo",
  "unused",
  "missing_variants"
] as const;

function withViewHref(view: "grid" | "table", params: {
  q?: string;
  provider: string;
  usage: string;
  needs: string;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.provider !== "all") search.set("provider", params.provider);
  if (params.usage !== "all") search.set("usage", params.usage);
  if (params.needs !== "all") search.set("needs", params.needs);
  search.set("view", view);
  return `/media?${search.toString()}`;
}

export default async function MediaPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    provider?: string;
    usage?: string;
    needs?: string;
    view?: string;
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
  const needs = needsFilters.includes(params.needs as (typeof needsFilters)[number])
    ? (params.needs as (typeof needsFilters)[number])
    : "all";
  const view = params.view === "table" ? "table" : "grid";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { rows: assets, total, pageSize } = await listMediaAssets({
    query: params.q,
    provider,
    usage,
    needs,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const usedCount = assets.filter((asset) => Number(asset.usageCount) > 0).length;
  const missingZhAltCount = assets.filter((asset) => !asset.zhAltText).length;
  const missingEnSeoCount = assets.filter(
    (asset) => !asset.enSeoTitle || !asset.enSeoDescription
  ).length;
  const selectedAsset = assets[0] ?? null;

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (provider !== "all") search.set("provider", provider);
    if (usage !== "all") search.set("usage", usage);
    if (needs !== "all") search.set("needs", needs);
    if (view !== "grid") search.set("view", view);
    search.set("page", String(nextPage));
    return `/media?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="媒体库"
        description="用图库或表格视图管理封面图片、双语替代文本、SEO 信息和使用状态。"
        icon={<Images size={20} />}
        actions={
          <>
            <ButtonLink href="/media/covers" variant="secondary">
              <Images size={17} />
              封面生成
            </ButtonLink>
            <ButtonLink href="/media/new" variant="primary">
              <ImagePlus size={17} />
              新建图片
            </ButtonLink>
          </>
        }
        metrics={
          <MetricStrip>
            <MetricTile label="筛选结果" value={total} note="当前查询总数" />
            <MetricTile label="当前页已使用" value={usedCount} note="关联文章封面" tone="success" />
            <MetricTile label="缺中文 alt" value={missingZhAltCount} note="可批量 AI 补全" tone="warning" />
            <MetricTile label="缺英文 SEO" value={missingEnSeoCount} note="可批量 AI 补全" tone="warning" />
          </MetricStrip>
        }
      />

      <FilterBar className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_180px_auto]">
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
        <select name="needs" defaultValue={needs} className={inputClassName}>
          <option value="all">全部补全状态</option>
          <option value="missing_zh_alt">缺中文 alt</option>
          <option value="missing_en_seo">缺英文 SEO</option>
          <option value="unused">未使用</option>
          <option value="missing_variants">无衍生图</option>
        </select>
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="page" value="1" />
        <button type="submit" className={buttonClassName("secondary")}>
          搜索
        </button>
      </FilterBar>

      <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <div className="text-sm text-slate-500">
          批量 AI 补全会按当前筛选取前 20 张图片，补齐双语替代文本和 SEO。
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={withViewHref("grid", { q: params.q, provider, usage, needs })}
            className={buttonClassName(view === "grid" ? "primary" : "secondary", "min-h-9")}
          >
            <Grid3X3 size={16} />
            图库
          </Link>
          <Link
            href={withViewHref("table", { q: params.q, provider, usage, needs })}
            className={buttonClassName(view === "table" ? "primary" : "secondary", "min-h-9")}
          >
            <List size={16} />
            表格
          </Link>
          <BulkMediaMetadataForm
            action={bulkGenerateMediaMetadataAction}
            q={params.q ?? ""}
            provider={provider}
            usage={usage}
            needs={needs}
          />
        </div>
      </div>

      <form id="bulk-delete-unused-media" action={deleteUnusedMediaAssetsAction} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {view === "grid" ? (
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <Link href={`/media/${asset.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.zhAltText || asset.altText || asset.enAltText}
                    className="aspect-video w-full bg-slate-100 object-cover"
                  />
                </Link>
                <div className="grid gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/media/${asset.id}`}
                      className="line-clamp-2 font-medium text-slate-950 hover:underline"
                    >
                      {asset.zhAltText || asset.altText || asset.originalFilename || "未命名图片"}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {asset.enAltText || "缺英文 alt"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                      {asset.storageProvider === "local" ? "已上传" : "外部 URL"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5",
                        Number(asset.usageCount) > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      )}
                    >
                      {Number(asset.usageCount) > 0
                        ? `${asset.usageCount} 篇文章`
                        : "未使用"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                      {asset.width && asset.height ? `${asset.width}x${asset.height}` : "尺寸未知"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={asset.url} label="复制" className="min-h-8 px-2" />
                    <Link
                      href={`/media/${asset.id}`}
                      className={buttonClassName("secondary", "min-h-8 px-2")}
                    >
                      详情
                    </Link>
                  </div>
                </div>
              </article>
            ))}
            {assets.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 sm:col-span-2 2xl:col-span-3">
                没有找到匹配的媒体资源。
              </div>
            ) : null}
          </section>
        ) : (
          <WideTable minWidth="1040px">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3 font-medium">选</th>
                <th className="px-5 py-3 font-medium">预览</th>
                <th className="px-5 py-3 font-medium">替代文本 / SEO</th>
                <th className="px-5 py-3 font-medium">来源</th>
                <th className="px-5 py-3 font-medium">使用</th>
                <th className="px-5 py-3 font-medium">尺寸</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id} className="align-top hover:bg-slate-50/60">
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
                  <td className="max-w-[260px] px-5 py-4 font-medium text-slate-900">
                    <Link href={`/media/${asset.id}`} className="hover:underline">
                      {asset.zhAltText || asset.altText || asset.originalFilename || "未命名图片"}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-xs font-normal text-slate-500">
                      EN: {asset.enAltText || "缺英文 alt"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-normal text-slate-400">
                      SEO: {asset.zhSeoDescription || asset.enSeoDescription || "未补全"}
                    </p>
                  </td>
                  <td className="max-w-[260px] px-5 py-4 text-slate-500">
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
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={asset.url} label="复制" className="min-h-8 px-2" />
                      <Link
                        href={`/media/${asset.id}`}
                        className={buttonClassName("secondary", "min-h-8 px-2")}
                      >
                        详情
                      </Link>
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
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    没有找到匹配的媒体资源。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </WideTable>
        )}

        <DetailDrawer
          title="资源摘要"
          description="默认展示当前筛选结果第一张图片，进入详情可编辑双语 SEO。"
          actions={
            selectedAsset ? (
              <Link
                href={`/media/${selectedAsset.id}`}
                className={buttonClassName("secondary", "min-h-9")}
              >
                打开详情
              </Link>
            ) : null
          }
        >
          {selectedAsset ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedAsset.url}
                alt={
                  selectedAsset.zhAltText ||
                  selectedAsset.altText ||
                  selectedAsset.enAltText
                }
                className="aspect-video w-full rounded-md border border-slate-200 object-cover"
              />
              <InfoList
                items={[
                  {
                    label: "中文 alt",
                    value: selectedAsset.zhAltText || selectedAsset.altText || "缺失"
                  },
                  { label: "英文 alt", value: selectedAsset.enAltText || "缺失" },
                  {
                    label: "使用状态",
                    value:
                      Number(selectedAsset.usageCount) > 0
                        ? `${selectedAsset.usageCount} 篇文章`
                        : "未使用"
                  },
                  {
                    label: "尺寸",
                    value:
                      selectedAsset.width && selectedAsset.height
                        ? `${selectedAsset.width} x ${selectedAsset.height}`
                        : "-"
                  },
                  { label: "文件大小", value: formatFileSize(selectedAsset.fileSize) },
                  { label: "创建时间", value: formatDate(selectedAsset.createdAt) }
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">当前筛选下暂无图片。</p>
          )}
        </DetailDrawer>
      </div>

      <StickyActionBar>
        <p className="text-slate-500">勾选未使用图片后可批量删除；已使用图片会自动跳过。</p>
        <ConfirmSubmitButton
          form="bulk-delete-unused-media"
          message="确定删除当前勾选的未使用图片吗？已使用图片会被自动跳过。"
          className="min-h-9 px-3"
        >
          批量删除未使用图片
        </ConfirmSubmitButton>
      </StickyActionBar>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          第 {page} / {pageCount} 页，共 {total} 条
        </span>
        <div className="flex gap-2">
          <Link
            className={buttonClassName(
              "secondary",
              page <= 1 ? "pointer-events-none opacity-50" : ""
            )}
            href={preserveParams(Math.max(page - 1, 1))}
          >
            上一页
          </Link>
          <Link
            className={buttonClassName(
              "secondary",
              page >= pageCount ? "pointer-events-none opacity-50" : ""
            )}
            href={preserveParams(Math.min(page + 1, pageCount))}
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
