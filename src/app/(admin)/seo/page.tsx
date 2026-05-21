import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName, ButtonLink } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { BulkPostSeoForm } from "@/components/forms/BulkPostSeoForm";
import { bulkGeneratePostSeoAction } from "@/server/content/actions";
import {
  listSeoAuditPosts,
  type SeoAuditIssue
} from "@/server/content/queries";

const issueOptions: Array<{ value: SeoAuditIssue | "all"; label: string }> = [
  { value: "all", label: "全部问题" },
  { value: "missing_title", label: "缺 title" },
  { value: "missing_description", label: "缺 description" },
  { value: "description_short", label: "描述过短" },
  { value: "description_long", label: "描述过长" },
  { value: "duplicate_seo", label: "重复 SEO" }
];

const localeOptions = [
  { value: "all", label: "全部语言" },
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" }
] as const;

function numberParam(value: string | undefined) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : 1;
}

function searchHref(params: {
  issue: string;
  locale: string;
  q: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params.issue !== "all") query.set("issue", params.issue);
  if (params.locale !== "all") query.set("locale", params.locale);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  return `/seo${query.toString() ? `?${query.toString()}` : ""}`;
}

export default async function SeoPage({
  searchParams
}: {
  searchParams: Promise<{
    issue?: SeoAuditIssue | "all";
    locale?: "en" | "zh" | "all";
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const issue = params.issue ?? "all";
  const locale = params.locale ?? "all";
  const q = params.q?.trim() ?? "";
  const page = numberParam(params.page);
  const audit = await listSeoAuditPosts({
    issue,
    locale,
    query: q,
    page,
    pageSize: 20
  });
  const totalPages = Math.max(Math.ceil(audit.total / audit.pageSize), 1);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          SEO 管理
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          审核文章页双语 SEO，集中发现缺失、长度异常和重复问题，并批量调用 AI 生成建议。
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {issueOptions.slice(1).map((option) => {
          const issueValue = option.value as SeoAuditIssue;
          return (
            <Link
              key={option.value}
              href={searchHref({ issue: issueValue, locale, q })}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-500">{option.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">
                {audit.issueCounts[issueValue]}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <form className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
            <label className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="q"
                defaultValue={q}
                className={`${inputClassName} w-full pl-9`}
                placeholder="搜索 slug、标题或 SEO 内容"
              />
            </label>
            <select name="issue" defaultValue={issue} className={inputClassName}>
              {issueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="locale" defaultValue={locale} className={inputClassName}>
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary")}>
              筛选
            </button>
          </form>
        </div>

        <BulkPostSeoForm action={bulkGeneratePostSeoAction}>
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
            <p className="text-sm text-slate-500">
              当前筛选共 {audit.total} 条语言版本记录。批量生成会按文章处理，最多选择 20 篇。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3 font-medium">选择</th>
                  <th className="px-4 py-3 font-medium">文章</th>
                  <th className="px-4 py-3 font-medium">语言</th>
                  <th className="px-4 py-3 font-medium">问题</th>
                  <th className="px-4 py-3 font-medium">SEO Title</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">扩展字段</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {audit.rows.map((row) => (
                  <tr key={`${row.postId}-${row.locale}`} className="align-top">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        name="postIds"
                        value={row.postId}
                        className="h-4 w-4 rounded border-slate-300 text-slate-700"
                      />
                    </td>
                    <td className="max-w-[280px] px-4 py-4">
                      <p className="font-medium text-slate-950">{row.title}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {row.slug}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone="archived">
                        {row.locale === "zh" ? "中文" : "英文"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {row.issueLabels.length ? (
                          row.issueLabels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">暂无问题</span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-4 text-slate-700">
                      {row.seoTitle || <span className="text-slate-400">未填写</span>}
                    </td>
                    <td className="max-w-[300px] px-4 py-4 text-slate-700">
                      <p>{row.seoDescription || "未填写"}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {row.descriptionLength} 字符
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      <p>canonical：{row.canonicalUrl ? "已填" : "未填"}</p>
                      <p>OG 图：{row.ogImage ? "已填" : "未填"}</p>
                      <p>
                        结构化数据：
                        {Object.keys(row.structuredData ?? {}).length ? "已填" : "默认"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <ButtonLink href={`/posts/${row.postId}/edit`}>
                        编辑
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
                {audit.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      当前筛选下没有 SEO 记录。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </BulkPostSeoForm>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>
            第 {audit.page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <ButtonLink
              href={searchHref({ issue, locale, q, page: Math.max(audit.page - 1, 1) })}
              className={audit.page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              上一页
            </ButtonLink>
            <ButtonLink
              href={searchHref({
                issue,
                locale,
                q,
                page: Math.min(audit.page + 1, totalPages)
              })}
              className={audit.page >= totalPages ? "pointer-events-none opacity-50" : ""}
            >
              下一页
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
