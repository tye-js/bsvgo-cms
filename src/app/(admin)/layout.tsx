import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { logoutAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";
import { getInitials, roleLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 font-bold text-white">
            B
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">BSVgo CMS</p>
            <p className="text-xs text-slate-500">内容管理后台</p>
          </div>
        </div>
        <AdminSidebar />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/92 px-5 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              管理工作台
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{roleLabel(user.role)}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {getInitials(user.name)}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        <main className="w-full px-3 py-6 sm:px-4 lg:px-5">
          {children}
        </main>
      </div>
    </div>
  );
}
