import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { PostMarkInlineEditor } from "@/components/forms/PostMarkInlineEditor";
import { PostMarkSelect } from "@/components/forms/PostMarkSelect";
import { formatDate, postStatusLabel } from "@/lib/utils";
import type { PostMarkFilter } from "@/lib/post-mark";
import {
  deletePostAction,
  updatePostMarkAction,
  setPostStatusAction
} from "@/server/content/actions";
import { listPosts } from "@/server/content/queries";
import type { PostStatus } from "@/server/db/schema";

const postMarkFilters = ["all", "empty", "featured", "pinned", "sponsored"];

export default async function PostsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    mark?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const status =
    params.status && ["draft", "published", "archived"].includes(params.status)
      ? (params.status as PostStatus)
      : "all";
  const mark =
    params.mark && postMarkFilters.includes(params.mark)
      ? (params.mark as PostMarkFilter)
      : "all";
  const page = Number(params.page ?? "1") || 1;
  const { rows, total, pageSize } = await listPosts({
    query: params.q,
    status,
    mark,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (status !== "all") search.set("status", status);
    if (mark !== "all") search.set("mark", mark);
    search.set("page", String(nextPage));
    return `/posts?${search.toString()}`;
  };

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
              placeholder="搜索标题或 slug"
            />
          </label>
          <select name="status" defaultValue={status} className={inputClassName}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
          <input type="hidden" name="mark" value={mark} />
          <input type="hidden" name="page" value="1" />
          <button className={buttonClassName("secondary")} type="submit">
            筛选
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-500">按标记筛选</p>
          <PostMarkSelect value={mark} />
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[210px]" />
              <col className="w-[170px]" />
              <col className="w-[170px]" />
              <col className="w-[240px]" />
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
                  <td className="px-4 py-3 text-slate-500 align-top">
                    <PostMarkInlineEditor
                      currentMark={post.mark}
                      action={updatePostMarkAction.bind(null, post.id)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
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
