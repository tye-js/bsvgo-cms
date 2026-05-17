import { UserForm } from "@/components/forms/UserForm";
import { requireRole } from "@/server/auth/session";
import { createUserAction } from "@/server/content/actions";

export default async function NewUserPage() {
  await requireRole(["admin"]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          新建管理员
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          创建使用哈希密码存储的安全账号。
        </p>
      </div>
      <UserForm action={createUserAction} />
    </div>
  );
}
