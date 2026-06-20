"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FilePlus2,
  FileText,
  FolderTree,
  Gauge,
  Image,
  Images,
  LayoutDashboard,
  Pin,
  SearchCheck,
  Settings,
  Shield,
  Sparkles,
  Tags,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavChild = {
  href: string;
  label: string;
};

type NavGroup = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: string[];
  children?: NavChild[];
};

const navGroups: NavGroup[] = [
  {
    href: "/dashboard",
    label: "工作台",
    icon: LayoutDashboard
  },
  {
    href: "/ai/jobs",
    label: "AI 任务",
    icon: Sparkles,
    match: ["/ai/jobs"]
  },
  {
    href: "/posts",
    label: "内容管理",
    icon: FileText,
    match: ["/posts", "/categories", "/tags"],
    children: [
      { href: "/posts", label: "文章列表" },
      { href: "/posts/drafts", label: "草稿箱" },
      { href: "/posts/ai-progress", label: "AI 进度" },
      { href: "/posts/new", label: "AI 改写" },
      { href: "/categories", label: "分类管理" },
      { href: "/tags", label: "标签管理" },
      { href: "/tags/new", label: "新建标签" }
    ]
  },
  {
    href: "/media",
    label: "媒体中心",
    icon: Image,
    match: ["/media"],
    children: [
      { href: "/media", label: "媒体库" },
      { href: "/media/covers", label: "封面生成" },
      { href: "/media/new", label: "新建图片" }
    ]
  },
  {
    href: "/seo",
    label: "SEO 与展示",
    icon: SearchCheck,
    match: ["/seo", "/placements"],
    children: [
      { href: "/seo", label: "SEO 总览" },
      { href: "/seo/opportunities", label: "内容优化" },
      { href: "/placements", label: "展示位" }
    ]
  },
  {
    href: "/users",
    label: "系统管理",
    icon: Shield,
    match: ["/users", "/settings"],
    children: [
      { href: "/users", label: "管理员" },
      { href: "/users/new", label: "新增管理员" },
      { href: "/settings", label: "系统设置" },
      { href: "/settings/audit", label: "设置审计" }
    ]
  }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: NavGroup) {
  if (isActive(pathname, group.href)) return true;
  return group.match?.some((href) => isActive(pathname, href)) ?? false;
}

function activeChildHref(pathname: string, children: NavChild[] | undefined) {
  if (!children?.length) return "";

  return children
    .filter((child) => isActive(pathname, child.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? "";
}

function childIcon(label: string) {
  if (label.includes("新建文章")) return FilePlus2;
  if (label.includes("AI")) return Sparkles;
  if (label.includes("封面")) return Images;
  if (label.includes("图片")) return Image;
  if (label.includes("分类")) return FolderTree;
  if (label.includes("标签")) return Tags;
  if (label.includes("展示")) return Pin;
  if (label.includes("管理员")) return Users;
  if (label.includes("设置")) return Settings;
  return Gauge;
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="grid max-h-[calc(100vh-4rem)] gap-2 overflow-auto p-3">
      {navGroups.map((group) => {
        const Icon = group.icon;
        const groupActive = isGroupActive(pathname, group);
        const activeHref = activeChildHref(pathname, group.children);

        return (
          <div key={group.label} className="grid gap-1">
            <Link
              href={group.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                groupActive
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <Icon size={18} />
              <span className="min-w-0 truncate">{group.label}</span>
            </Link>

            {group.children?.length ? (
              <div className="ml-5 grid gap-0.5 border-l border-slate-200 pl-3">
                {group.children.map((child) => {
                  const ChildIcon = childIcon(child.label);
                  const childActive = activeHref === child.href;

                  return (
                    <Link
                      key={`${group.label}-${child.label}-${child.href}`}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                        childActive
                          ? "bg-slate-100 font-medium text-slate-950"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <ChildIcon size={14} />
                      <span className="min-w-0 truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
