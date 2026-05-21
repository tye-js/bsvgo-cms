import { PostPlacementsForm } from "@/components/forms/PostPlacementsForm";
import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { updatePostPlacementsAction } from "@/server/content/actions";
import { getPostEditorOptions, listPlacementPosts } from "@/server/content/queries";
import type { PostStatus } from "@/server/db/schema";

export default async function PlacementsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    categoryId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const status =
    params.status && ["draft", "published", "archived"].includes(params.status)
      ? (params.status as PostStatus)
      : "all";
  const page = Number(params.page ?? "1") || 1;
  const { categories } = await getPostEditorOptions();
  const selectedCategoryId = params.categoryId ?? "";
  const categoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : "all";
  const { rows, total, pageSize } = await listPlacementPosts({
    query: params.q,
    status,
    categoryId,
    page
  });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  const preserveParams = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (status !== "all") search.set("status", status);
    if (categoryId !== "all") search.set("categoryId", categoryId);
    search.set("page", String(nextPage));
    return `/placements?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          展示位
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          集中管理首页和分类页的置顶、推广文章。文章内容和 SEO 仍在文章编辑页维护。
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          className={inputClassName}
          placeholder="搜索标题或 slug"
        />
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
        <input type="hidden" name="page" value="1" />
        <button className={buttonClassName("secondary")} type="submit">
          筛选
        </button>
      </form>

      <PostPlacementsForm
        posts={rows}
        action={updatePostPlacementsAction}
      />

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
