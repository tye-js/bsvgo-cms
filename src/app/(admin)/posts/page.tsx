import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { inputClassName } from "@/components/admin/Field";
import { formatDate, postStatusLabel } from "@/lib/utils";
import {
  deletePostAction,
  setPostStatusAction
} from "@/server/content/actions";
import { listPosts } from "@/server/content/queries";
import type { PostStatus } from "@/server/db/schema";

export default async function PostsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status && ["draft", "published", "archived"].includes(params.status)
      ? (params.status as PostStatus)
      : "all";
  const page = Number(params.page ?? "1") || 1;
  const { rows, total, pageSize } = await listPosts({
    query: params.q,
    status,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">文章</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理多语言文章、发布状态、标签和发布元信息。
          </p>
        </div>
        <ButtonLink href="/posts/new" variant="primary">
          新建文章
        </ButtonLink>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className={`${inputClassName} w-full pl-10`}
            placeholder="搜索标题或 slug"
          />
        </label>
        <select name="status" defaultValue={status} className={inputClassName}>
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <button className={buttonClassName("secondary")} type="submit">
          筛选
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[85px]" />
              <col className="w-[170px]" />
              <col className="w-[170px]" />
              <col className="w-[255px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">分类</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">标记</th>
                <th className="px-4 py-3 font-medium">发布时间</th>
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
                      className="block truncate font-medium text-slate-950 hover:text-slate-700"
                      title={post.title}
                    >
                      {post.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500" title={post.slug}>
                      {post.slug}
                    </p>
                  </td>
                  <td className="truncate px-4 py-3 text-slate-600" title={post.categoryName}>
                    {post.categoryName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={post.status}>{postStatusLabel(post.status)}</Badge>
                  </td>
                  <td className="truncate px-4 py-3 text-slate-500">
                    {[post.featured ? "精选" : null, post.pinned ? "置顶" : null]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Link
                        href={`/posts/${post.id}/edit`}
                        className={buttonClassName("secondary", "min-h-8 px-2")}
                      >
                        编辑
                      </Link>
                      <form action={setPostStatusAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={post.status === "published" ? "draft" : "published"}
                        />
                        <button
                          type="submit"
                          className={buttonClassName("ghost", "min-h-8 px-2")}
                        >
                          {post.status === "published" ? "下架" : "发布"}
                        </button>
                      </form>
                      <form action={deletePostAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <ConfirmSubmitButton
                          message="确定删除这篇文章吗？它会从后台列表中移除。"
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
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    未找到文章。
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
              className={buttonClassName("secondary", page <= 1 ? "pointer-events-none opacity-50" : "")}
              href={`/posts?page=${Math.max(page - 1, 1)}&status=${status}&q=${params.q ?? ""}`}
            >
              上一页
            </Link>
            <Link
              className={buttonClassName(
                "secondary",
                page >= pageCount ? "pointer-events-none opacity-50" : ""
              )}
              href={`/posts?page=${Math.min(page + 1, pageCount)}&status=${status}&q=${params.q ?? ""}`}
            >
              下一页
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
