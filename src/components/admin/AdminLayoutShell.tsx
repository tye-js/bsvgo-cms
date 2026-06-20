"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useState } from "react";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { cn, getInitials, roleLabel } from "@/lib/utils";

export function AdminLayoutShell({
  children,
  userArea
}: {
  children: React.ReactNode;
  userArea: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 lg:grid",
        collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[260px_1fr]"
      )}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[76px]" : "lg:w-[260px]"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-200 px-4",
            collapsed ? "justify-center lg:px-3" : "justify-between gap-3"
          )}
        >
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 font-bold text-white">
              B
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  BSVgo CMS
                </p>
                <p className="truncate text-xs text-slate-500">内容管理后台</p>
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
            title="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>
        <AdminSidebar collapsed={collapsed} />
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭菜单遮罩"
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/92 px-3 backdrop-blur sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
              title="打开菜单"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="hidden h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:inline-flex"
              title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <Link
              href="/posts"
              className="hidden h-9 min-w-[260px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition hover:bg-white xl:flex"
            >
              <Search size={16} />
              <span>搜索文章、任务和媒体</span>
            </Link>
          </div>
          {userArea}
        </header>
        <main className="w-full px-3 py-6 sm:px-4 lg:px-5">{children}</main>
      </div>
    </div>
  );
}

export function AdminUserBadge({
  name,
  role,
  logoutForm
}: {
  name: string;
  role: string;
  logoutForm: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{roleLabel(role)}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
        {getInitials(name)}
      </div>
      {logoutForm}
    </div>
  );
}
