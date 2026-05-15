import Link from "next/link";

import { buttonClassName } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";
import { listCategories } from "@/server/content/queries";

export default async function CategoriesPage() {
  const rows = await listCategories();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Categories
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Main categories are fixed for BSVgo; editors can update multilingual labels, descriptions, and SEO metadata.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">English</th>
                <th className="px-5 py-3 font-medium">Chinese</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">SEO title</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((category) => (
                <tr key={category.id}>
                  <td className="px-5 py-4 font-medium text-slate-950">
                    {category.enName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{category.zhName}</td>
                  <td className="px-5 py-4 text-slate-500">{category.slug}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {category.seoTitle ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(category.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/categories/${category.id}/edit`}
                      className={buttonClassName("secondary", "min-h-8 px-2")}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
