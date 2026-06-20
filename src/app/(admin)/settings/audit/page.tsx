import Link from "next/link";
import { History } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { formatDate } from "@/lib/utils";
import { requireRole } from "@/server/auth/session";
import { listSettingAuditLogs } from "@/server/settings/service";

function numberParam(value: string | undefined) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : 1;
}

function pageHref(page: number) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  return `/settings/audit${query.toString() ? `?${query.toString()}` : ""}`;
}

export default async function SettingsAuditPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(["admin"]);

  const params = await searchParams;
  const page = numberParam(params.page);
  const audit = await listSettingAuditLogs({ page, pageSize: 30 });
  const pageCount = Math.max(Math.ceil(audit.total / audit.pageSize), 1);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <History size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                设置变更审计
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                记录 AI Key、模型、Base URL、提示词、封面风格和 SEO 设置的修改人、时间和旧新值摘要。
              </p>
            </div>
          </div>
        </div>
        <Link href="/settings" className={buttonClassName("secondary", "shrink-0")}>
          返回设置
        </Link>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          共 {audit.total} 条设置变更。API Key 只记录安全摘要，不保存原始密钥。
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[250px]" />
              <col className="w-[260px]" />
              <col className="w-[260px]" />
              <col className="w-[190px]" />
              <col className="w-[190px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">配置项</th>
                <th className="px-4 py-3 font-medium">旧值摘要</th>
                <th className="px-4 py-3 font-medium">新值摘要</th>
                <th className="px-4 py-3 font-medium">修改人</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="break-all px-4 py-4 font-medium text-slate-950">
                    {row.settingKey}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p className="line-clamp-4 whitespace-pre-wrap leading-6">
                      {row.oldValueSummary || "未配置"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p className="line-clamp-4 whitespace-pre-wrap leading-6">
                      {row.newValueSummary || "未配置"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p className="font-medium text-slate-800">
                      {row.changedByName ?? "未知用户"}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {row.changedByEmail ?? row.changedBy ?? "-"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
              {audit.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    暂无设置变更记录。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          <span>
            第 {audit.page} / {pageCount} 页
          </span>
          <div className="flex gap-2">
            <Link
              className={buttonClassName(
                "secondary",
                audit.page <= 1 ? "pointer-events-none opacity-50" : ""
              )}
              href={pageHref(Math.max(audit.page - 1, 1))}
            >
              上一页
            </Link>
            <Link
              className={buttonClassName(
                "secondary",
                audit.page >= pageCount ? "pointer-events-none opacity-50" : ""
              )}
              href={pageHref(Math.min(audit.page + 1, pageCount))}
            >
              下一页
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
