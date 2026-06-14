import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCcw, Sparkles } from "lucide-react";

import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { CopyButton } from "@/components/admin/CopyButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { formatDate } from "@/lib/utils";
import {
  deleteMediaAssetAction,
  generateMediaMetadataAction,
  regenerateMediaVariantsAction
} from "@/server/media/actions";
import { getMediaAsset, getMediaAssetUsage } from "@/server/media/service";

function formatFileSize(size: number | null | undefined) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [asset, usage] = await Promise.all([
    getMediaAsset(id),
    getMediaAssetUsage(id)
  ]);

  if (!asset) notFound();

  const canGenerateVariants = asset.storageProvider === "local" && asset.storageKey;
  const seoSummary =
    typeof asset.metadata?.seoSummary === "string" ? asset.metadata.seoSummary : "";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <ButtonLink href="/media" className="mb-3 min-h-8 px-2 text-xs">
            <ArrowLeft size={14} />
            返回媒体库
          </ButtonLink>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            图片详情
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            查看图片元数据、派生版本，以及被哪些文章使用。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={asset.url} label="复制来源" />
          <form action={generateMediaMetadataAction}>
            <input type="hidden" name="id" value={asset.id} />
            <SubmitButton pendingLabel="AI 生成中..." timeoutMs={90000}>
              <Sparkles size={16} />
              AI 生成图片 SEO
            </SubmitButton>
          </form>
          {canGenerateVariants ? (
            <form action={regenerateMediaVariantsAction}>
              <input type="hidden" name="id" value={asset.id} />
              <SubmitButton variant="secondary" pendingLabel="生成中..." timeoutMs={90000}>
                <RefreshCcw size={16} />
                重新生成多尺寸
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt={asset.altText}
            className="max-h-[620px] w-full bg-slate-50 object-contain"
          />
          <div className="grid gap-3 border-t border-slate-200 p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Alt text
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {asset.altText || "未填写"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Caption
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {asset.caption || "未填写"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                SEO 摘要
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {seoSummary || "未生成"}
              </p>
            </div>
            <p className="break-all text-xs text-slate-500">{asset.url}</p>
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-950">文件信息</h2>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">来源</dt>
                <dd className="font-medium text-slate-900">
                  {asset.storageProvider === "local" ? "已上传" : "外部 URL"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">尺寸</dt>
                <dd className="font-medium text-slate-900">
                  {asset.width && asset.height ? `${asset.width} x ${asset.height}` : "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">大小</dt>
                <dd className="font-medium text-slate-900">
                  {formatFileSize(asset.fileSize)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">文件名</dt>
                <dd className="max-w-[220px] truncate font-medium text-slate-900">
                  {asset.originalFilename || "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">创建时间</dt>
                <dd className="font-medium text-slate-900">
                  {formatDate(asset.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-950">危险操作</h2>
            <form action={deleteMediaAssetAction}>
              <input type="hidden" name="id" value={asset.id} />
              <ConfirmSubmitButton
                message="确定从媒体库删除这张图片吗？已有文章会保留当前封面 URL。"
                className="w-full"
              >
                删除图片
              </ConfirmSubmitButton>
            </form>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold text-slate-950">使用情况</h2>
          <p className="mt-1 text-sm text-slate-500">
            当前图片被 {usage.length} 篇未删除文章作为封面使用。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">文章</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">更新时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usage.map((post) => (
                <tr key={post.id}>
                  <td className="px-5 py-4 font-medium text-slate-950">
                    {post.title}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{post.slug}</td>
                  <td className="px-5 py-4 text-slate-500">{post.status}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <a
                      href={`/posts/${post.id}/edit`}
                      className={buttonClassName("secondary", "min-h-8 px-2")}
                    >
                      编辑文章
                    </a>
                  </td>
                </tr>
              ))}
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    暂无文章使用这张图片。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold text-slate-950">WebP / AVIF 多尺寸版本</h2>
          <p className="mt-1 text-sm text-slate-500">
            本地上传图片会自动生成多尺寸版本，供前端后续按需读取。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">格式</th>
                <th className="px-5 py-3 font-medium">尺寸</th>
                <th className="px-5 py-3 font-medium">大小</th>
                <th className="px-5 py-3 font-medium">URL</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(asset.variants ?? []).map((variant) => (
                <tr key={variant.storageKey}>
                  <td className="px-5 py-4 font-medium uppercase text-slate-950">
                    {variant.format}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {variant.width} x {variant.height}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatFileSize(variant.fileSize)}
                  </td>
                  <td className="max-w-[420px] px-5 py-4">
                    <p className="line-clamp-2 break-all text-slate-500">
                      {variant.url}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <CopyButton value={variant.url} label="复制" />
                  </td>
                </tr>
              ))}
              {(asset.variants ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    暂无派生版本。本地上传图片可点击“重新生成多尺寸”补齐。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
