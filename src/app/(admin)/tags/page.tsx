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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Tags</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage multilingual tags used for filtering and related-post recommendations.
          </p>
        </div>
        <ButtonLink href="/tags/new" variant="primary">
          New tag
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
            placeholder="Search name or slug"
          />
        </label>
        <button type="submit" className={buttonClassName("secondary")}>
          Filter
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">English</th>
                <th className="px-5 py-3 font-medium">Chinese</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Posts</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((tag) => (
                <tr key={tag.id}>
                  <td className="px-5 py-4 font-medium text-slate-950">{tag.enName}</td>
                  <td className="px-5 py-4 text-slate-600">{tag.zhName ?? "-"}</td>
                  <td className="px-5 py-4 text-slate-500">{tag.slug}</td>
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
                        Edit
                      </Link>
                      <form action={deleteTagAction}>
                        <input type="hidden" name="id" value={tag.id} />
                        <ConfirmSubmitButton
                          message="Delete this tag? It will be detached from posts."
                          className="min-h-8 px-2"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No tags found.
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
