import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  Users
} from "lucide-react";

import { logoutAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";
import { getInitials, roleLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard },
  { href: "/posts", label: "文章", icon: FileText },
  { href: "/media", label: "媒体库", icon: Image },
  { href: "/categories", label: "分类", icon: FolderTree },
  { href: "/tags", label: "标签", icon: Tags },
  { href: "/users", label: "管理员", icon: Users },
  { href: "/settings", label: "设置", icon: Settings }
];

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 font-bold text-white">
            B
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">BSVgo CMS</p>
            <p className="text-xs text-slate-500">内容管理后台</p>
          </div>
        </div>
        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
