import Link from "next/link";
import { Search } from "lucide-react";

import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { inputClassName } from "@/components/admin/Field";
import { formatDate } from "@/lib/utils";
import { deleteTagAction } from "@/server/content/actions";
import { listTags } from "@/server/content/queries";

export default async function TagsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const rows = await listTags(params.q);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">标签</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理用于筛选和相关文章推荐的多语言标签。
          </p>
        </div>
        <ButtonLink href="/tags/new" variant="primary">
          新建标签
        </ButtonLink>
      </div>

      <form className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className={`${inputClassName} w-full pl-10`}
            placeholder="搜索名称或 slug"
          />
        </label>
        <button type="submit" className={buttonClassName("secondary")}>
          筛选
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">英文</th>
                <th className="px-5 py-3 font-medium">中文</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">英文 SEO</th>
                <th className="px-5 py-3 font-medium">中文 SEO</th>
                <th className="px-5 py-3 font-medium">文章数</th>
                <th className="px-5 py-3 font-medium">更新时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((tag) => (
                <tr key={tag.id}>
                  <td className="px-5 py-4 font-medium text-slate-950">{tag.enName}</td>
                  <td className="px-5 py-4 text-slate-600">{tag.zhName ?? "-"}</td>
                  <td className="px-5 py-4 text-slate-500">{tag.slug}</td>
                  <td className="px-5 py-4 text-slate-500">{tag.enSeoTitle || "-"}</td>
                  <td className="px-5 py-4 text-slate-500">{tag.zhSeoTitle || "-"}</td>
                  <td className="px-5 py-4 text-slate-500">{tag.postCount}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(tag.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/tags/${tag.id}/edit`}
                        className={buttonClassName("secondary", "min-h-8 px-2")}
                      >
                        编辑
                      </Link>
                      <form action={deleteTagAction}>
                        <input type="hidden" name="id" value={tag.id} />
                        <ConfirmSubmitButton
                          message="确定删除这个标签吗？它会从相关文章中解绑。"
                          className="min-h-8 px-2"
                        >
                          删除
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    未找到标签。
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
