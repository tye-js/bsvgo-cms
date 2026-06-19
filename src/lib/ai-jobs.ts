import type { AiJobStatus, AiJobType } from "@/server/db/schema";

export function aiJobTypeLabel(type: string) {
  const labels: Record<AiJobType, string> = {
    post_draft_rewrite: "中文改写",
    post_draft_translate: "英文生成",
    post_draft_metadata: "文章元信息",
    post_draft_create: "AI 改写成文",
    media_metadata: "图片 SEO",
    bulk_media_metadata: "批量图片补全",
    bulk_post_seo: "批量文章 SEO",
    bulk_post_cover_images: "文章封面生成"
  };

  return labels[type as AiJobType] ?? type;
}

export function aiJobStatusLabel(status: string) {
  const labels: Record<AiJobStatus, string> = {
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成",
    failed: "失败"
  };

  return labels[status as AiJobStatus] ?? status;
}

export function aiJobStatusClassName(status: string) {
  if (status === "succeeded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "running") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function stringifyJson(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}
