import Link from "next/link";
import { Search } from "lucide-react";

import { PostPlacementsForm } from "@/components/forms/PostPlacementsForm";
import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { updatePostPlacementsAction } from "@/server/content/actions";
import { getPostEditorOptions, listPlacementPosts } from "@/server/content/queries";
import type { PostStatus } from "@/server/db/schema";

const placementFilters = [
  "all",
  "homeFeatured",
  "homePromoted",
  "categoryFeatured",
  "categoryPromoted"
] as const;

type PlacementFilter = (typeof placementFilters)[number];

export default async function PlacementsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    categoryId?: string;
    placement?: string;
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
  const { categories } = await getPostEditorOptions();
  const selectedCategoryId = params.categoryId ?? "";
  const categoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : "all";
  const placement = placementFilters.includes(params.placement as PlacementFilter)
    ? (params.placement as PlacementFilter)
    : "all";
  const { rows, total, pageSize } = await listPlacementPosts({
    query: params.q,
    status,
    categoryId,
    placement,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const activePosts = rows.filter((post) =>
    Object.values(post.placements).some((placement) => placement?.enabled)
  ).length;
  const activeSlots = rows.reduce(
    (count, post) =>
      count +
      Object.values(post.placements).filter((placement) => placement?.enabled).length,
    0
  );

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (status !== "all") search.set("status", status);
    if (categoryId !== "all") search.set("categoryId", categoryId);
    if (placement !== "all") search.set("placement", placement);
    search.set("page", String(nextPage));
    return `/placements?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            展示位
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            集中管理首页和分类页的置顶、推广文章。文章内容和 SEO 仍在文章编辑页维护。
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
          <div className="border-r border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">当前页文章</p>
            <p className="mt-1 font-semibold text-slate-950">{rows.length}</p>
          </div>
          <div className="border-r border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">已配置文章</p>
            <p className="mt-1 font-semibold text-slate-950">{activePosts}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-slate-500">启用槽位</p>
            <p className="mt-1 font-semibold text-slate-950">{activeSlots}</p>
          </div>
        </div>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_160px_190px_180px_auto]">
        <label className="relative">
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
        <select name="categoryId" defaultValue={categoryId} className={inputClassName}>
          <option value="all">全部分类</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="placement" defaultValue={placement} className={inputClassName}>
          <option value="all">全部展示位</option>
          <option value="homeFeatured">首页置顶</option>
          <option value="homePromoted">首页推广</option>
          <option value="categoryFeatured">分类置顶</option>
          <option value="categoryPromoted">分类推广</option>
        </select>
        <input type="hidden" name="page" value="1" />
        <button className={buttonClassName("secondary")} type="submit">
          筛选
        </button>
      </form>

      <div className="grid gap-3">
        <div className="flex flex-col justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
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

        <PostPlacementsForm
          posts={rows}
          action={updatePostPlacementsAction}
        />
      </div>
    </div>
  );
}
