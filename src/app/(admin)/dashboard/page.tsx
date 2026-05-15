import Link from "next/link";
import { FileText, FolderTree, Tags, Clock } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { ButtonLink } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";
import { getDashboardStats } from "@/server/content/queries";

const statCards = [
  { label: "Total posts", key: "posts", icon: FileText },
  { label: "Published", key: "published", icon: Clock },
  { label: "Drafts", key: "drafts", icon: FileText },
  { label: "Categories", key: "categories", icon: FolderTree },
  { label: "Tags", key: "tags", icon: Tags }
] as const;

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Publishing status, taxonomy coverage, and recent editorial updates.
          </p>
        </div>
        <ButtonLink href="/posts/new" variant="primary">
          New post
        </ButtonLink>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <Icon size={18} className="text-slate-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {stats[card.key]}
              </p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-950">Recently updated</h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest post edits across all statuses.
            </p>
          </div>
          <ButtonLink href="/posts">View posts</ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentPosts.map((post) => (
                <tr key={post.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <Link href={`/posts/${post.id}/edit`} className="hover:text-slate-700">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{post.slug}</td>
                  <td className="px-5 py-3">
                    <Badge tone={post.status}>{post.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {formatDate(post.updatedAt)}
                  </td>
                </tr>
              ))}
              {stats.recentPosts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                    No posts yet.
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
