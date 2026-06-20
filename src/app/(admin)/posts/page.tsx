import Image from "next/image";
import Link from "next/link";
import { FileText, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { ButtonLink, buttonClassName } from "@/components/admin/Button";
import { FilterBar, StickyActionBar, WideTable } from "@/components/admin/DataLayout";
import { inputClassName } from "@/components/admin/Field";
import { MetricStrip, MetricTile, PageHeader } from "@/components/admin/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { getAiWritingRole } from "@/lib/ai-style";
import { cn, formatDate, postStatusLabel } from "@/lib/utils";
import {
  deletePostAction,
  setPostStatusAction
} from "@/server/content/actions";
import { listPosts } from "@/server/content/queries";
import type { PostStatus } from "@/server/db/schema";

function statusTone(status: PostStatus) {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

function markLabel(mark: string) {
  if (mark === "featured") return "首页推荐";
  if (mark === "pinned") return "置顶";
  if (mark === "sponsored") return "推广";
  return "常规";
}

export default async function PostsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const status =
    params.status && ["draft", "published", "archived"].includes(params.status)
      ? (params.status as PostStatus)
      : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { rows, total, pageSize } = await listPosts({
    query: params.q,
    status,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const publishedCount = rows.filter((post) => post.status === "published").length;
  const draftCount = rows.filter((post) => post.status === "draft").length;
  const aiAuthorCount = rows.filter((post) => post.aiAuthorRole).length;

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (status !== "all") search.set("status", status);
    search.set("page", String(nextPage));
    return `/posts?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="文章运营"
        description="按中文内容优先查看文章，快速处理发布、草稿、AI 作者和展示状态。"
        icon={<FileText size={20} />}
        actions={
          <ButtonLink href="/posts/new" variant="primary">
            <Sparkles size={17} />
            AI 改写
          </ButtonLink>
        }
        metrics={
          <MetricStrip>
            <MetricTile label="筛选结果" value={total} note="当前查询总数" />
            <MetricTile
              label="当前页已发布"
              value={publishedCount}
              note="可在列表直接下架"
              tone="success"
            />
            <MetricTile
              label="当前页草稿"
              value={draftCount}
              note="可继续编辑或发布"
              tone="warning"
            />
            <MetricTile
              label="AI 作者"
              value={aiAuthorCount}
              note="当前页已绑定 AI 人设"
              tone="active"
            />
          </MetricStrip>
        }
      />

      <FilterBar className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className={`${inputClassName} w-full pl-10`}
            placeholder="搜索中文/英文标题或 slug"
          />
        </label>
        <select name="status" defaultValue={status} className={inputClassName}>
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <input type="hidden" name="page" value="1" />
        <button className={buttonClassName("secondary")} type="submit">
          筛选
        </button>
      </FilterBar>

      <WideTable
        minWidth="1460px"
        footer={
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
        }
      >
        <colgroup>
          <col className="w-[48px]" />
          <col className="w-[340px]" />
          <col className="w-[150px]" />
          <col className="w-[110px]" />
          <col className="w-[170px]" />
          <col className="w-[150px]" />
          <col className="w-[170px]" />
          <col className="w-[170px]" />
          <col className="w-[190px]" />
        </colgroup>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">选</th>
            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-medium">
              中文优先标题
            </th>
            <th className="px-4 py-3 font-medium">分类</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">AI 作者</th>
            <th className="px-4 py-3 font-medium">展示状态</th>
            <th className="px-4 py-3 font-medium">发布时间</th>
            <th className="px-4 py-3 font-medium">更新时间</th>
            <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3 font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((post) => {
            const aiAuthor = post.aiAuthorRole
              ? getAiWritingRole(post.aiAuthorRole)
              : null;
            const aiAuthorZhName = post.aiAuthorZhName ?? aiAuthor?.zhName;
            const aiAuthorEnName = post.aiAuthorEnName ?? aiAuthor?.enName;
            const aiAuthorAvatar = post.aiAuthorAvatar ?? aiAuthor?.avatar;

            return (
              <tr key={post.id} className="group h-16 align-middle hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-700"
                    aria-label={`选择文章 ${post.title}`}
                  />
                </td>
                <td className="sticky left-0 z-10 max-w-0 bg-white px-4 py-3 group-hover:bg-slate-50">
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
                <td className="px-4 py-3">
                  {aiAuthor && aiAuthorZhName && aiAuthorEnName && aiAuthorAvatar ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Image
                        src={aiAuthorAvatar}
                        alt={aiAuthorZhName}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 rounded-full bg-slate-100"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {aiAuthorZhName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {aiAuthorEnName}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">未设置</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                      statusTone(post.status) === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : statusTone(post.status) === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    )}
                  >
                    {markLabel(post.mark)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {formatDate(post.publishedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {formatDate(post.updatedAt)}
                </td>
                <td className="sticky right-0 z-10 bg-white px-4 py-3">
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
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                未找到文章。
              </td>
            </tr>
          ) : null}
        </tbody>
      </WideTable>

      <StickyActionBar>
        <p className="text-slate-500">
          勾选文章后可扩展批量发布、批量 SEO、批量封面等操作。
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/seo" className={buttonClassName("secondary", "min-h-9")}>
            批量 SEO
          </Link>
          <Link href="/media/covers" className={buttonClassName("secondary", "min-h-9")}>
            批量封面
          </Link>
        </div>
      </StickyActionBar>
    </div>
  );
}
