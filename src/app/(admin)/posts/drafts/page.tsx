import Link from "next/link";
import { FileText, Search } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { formatDate, postStatusLabel } from "@/lib/utils";
import { listPosts } from "@/server/content/queries";

export default async function DraftPostsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { rows, total, pageSize } = await listPosts({
    query: params.q,
    status: "draft",
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    search.set("page", String(nextPage));
    return `/posts/drafts?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            草稿箱
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            集中查看未发布文章，进入单篇后继续编辑、生成封面或发布。
          </p>
        </div>
        <ButtonLink href="/posts/new" variant="primary">
          新建文章
        </ButtonLink>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              className={`${inputClassName} w-full pl-10`}
              placeholder="搜索草稿标题或 slug"
            />
          </label>
          <input type="hidden" name="page" value="1" />
          <button className={buttonClassName("secondary")} type="submit">
            筛选
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[360px]" />
              <col className="w-[160px]" />
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">草稿</th>
                <th className="px-4 py-3 font-medium">分类</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((post) => (
                <tr key={post.id} className="h-16 align-middle">
                  <td className="max-w-0 px-4 py-3">
                    <Link
                      href={`/posts/${post.id}/edit`}
                      className="flex min-w-0 items-center gap-3 font-medium text-slate-950 hover:text-slate-700"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                        <FileText size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate" title={post.title}>
                          {post.title}
                        </span>
                        <span
                          className="mt-1 block truncate text-xs font-normal text-slate-500"
                          title={post.slug}
                        >
                          {post.slug}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td
                    className="truncate px-4 py-3 text-slate-600"
                    title={post.categoryName}
                  >
                    {post.categoryName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={post.status}>{postStatusLabel(post.status)}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/posts/${post.id}/edit`}
                      className={buttonClassName("secondary", "min-h-8 px-2")}
                    >
                      修改
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    没有找到草稿。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
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
      </section>
    </div>
  );
}
