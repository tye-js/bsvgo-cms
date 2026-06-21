import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import {
  AdminLayoutShell,
  AdminUserBadge
} from "@/components/admin/AdminLayoutShell";
import { AdminToast } from "@/components/admin/AdminToast";
import { logoutAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  if (!user) redirect("/login");

  return (
    <AdminLayoutShell
      userArea={
        <AdminUserBadge
          name={user.name}
          role={user.role}
          logoutForm={
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </form>
          }
        />
      }
    >
      {children}
      <AdminToast />
    </AdminLayoutShell>
  );
}
