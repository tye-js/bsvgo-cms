import { ImagePlus } from "lucide-react";

import { ButtonLink } from "@/components/admin/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { formatDate } from "@/lib/utils";
import { deleteMediaAssetAction } from "@/server/media/actions";
import { listMediaAssets } from "@/server/media/service";

function formatFileSize(size: number | null) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage() {
  const assets = await listMediaAssets();

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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">预览</th>
                <th className="px-5 py-3 font-medium">替代文本</th>
                <th className="px-5 py-3 font-medium">来源</th>
                <th className="px-5 py-3 font-medium">尺寸</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-5 py-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.altText}
                      className="h-14 w-24 rounded-md border border-slate-200 object-cover"
                    />
                  </td>
                  <td className="max-w-[220px] px-5 py-4 font-medium text-slate-900">
                    {asset.altText}
                    {asset.caption ? (
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-slate-500">
                        {asset.caption}
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
                    <span className="block">
                      {asset.width && asset.height ? `${asset.width} x ${asset.height}` : "-"}
                    </span>
                    <span className="text-xs">{formatFileSize(asset.fileSize)}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(asset.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <form action={deleteMediaAssetAction}>
                      <input type="hidden" name="id" value={asset.id} />
                      <ConfirmSubmitButton
                        message="确定从媒体库删除这张图片吗？已有文章会保留当前封面 URL。"
                        className="min-h-8 px-2"
                      >
                        删除
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    暂无媒体资源。
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
