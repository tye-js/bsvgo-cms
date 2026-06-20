import Link from "next/link";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";
import { listTopicCollections } from "@/server/content/queries";

function collectionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };

  return labels[status] ?? status;
}

export default async function CollectionsPage() {
  const rows = await listTopicCollections();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          专题辑
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          管理专题文章集合和专题内排序。同一篇文章可以在不同专题里拥有不同顺序。
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">专题</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">文章数</th>
                <th className="px-5 py-3 font-medium">排序</th>
                <th className="px-5 py-3 font-medium">更新时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((collection) => (
                <tr key={collection.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-950">
                      {collection.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {collection.enTitle || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {collection.slug}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={collection.status}>
                      {collectionStatusLabel(collection.status)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {collection.postCount}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {collection.sortOrder}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(collection.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/collections/${collection.id}`}
                      className={buttonClassName("secondary", "min-h-8 px-2")}
                    >
                      管理文章
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    暂无专题。
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
