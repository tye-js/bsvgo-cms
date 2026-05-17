import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toDateInputValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 16);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export function postStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };

  return labels[status] ?? status;
}

export function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "管理员",
    editor: "编辑"
  };

  return labels[role] ?? role;
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
