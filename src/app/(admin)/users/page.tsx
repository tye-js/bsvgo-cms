import { Badge } from "@/components/admin/Badge";
import { ButtonLink } from "@/components/admin/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { formatDate, roleLabel } from "@/lib/utils";
import { requireRole } from "@/server/auth/session";
import { deleteUserAction } from "@/server/content/actions";
import { listUsers } from "@/server/content/queries";

export default async function UsersPage() {
  const currentUser = await requireRole(["admin"]);
  const rows = await listUsers();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            管理员
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            管理 CMS 的管理员和编辑账号权限。
          </p>
        </div>
        <ButtonLink href="/users/new" variant="primary">
          新建用户
        </ButtonLink>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">姓名</th>
                <th className="px-5 py-3 font-medium">邮箱</th>
                <th className="px-5 py-3 font-medium">角色</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4 font-medium text-slate-950">{user.name}</td>
                  <td className="px-5 py-4 text-slate-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <Badge tone={user.role}>{roleLabel(user.role)}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    {user.id === currentUser.id ? (
                      <span className="text-xs text-slate-500">当前用户</span>
                    ) : (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <ConfirmSubmitButton
                          message="确定移除这个管理员账号吗？"
                          className="min-h-8 px-2"
                        >
                          移除
                        </ConfirmSubmitButton>
                      </form>
                    )}
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
