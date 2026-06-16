import { z } from "zod";

import { aiWritingRoleIds } from "@/lib/ai-style";
import { imageGenerationPresetValues } from "@/lib/image-generation";

export const placementSchema = z.object({
  enabled: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  startsAt: z.string().optional(),
  endsAt: z.string().optional()
}).refine((value) => {
  if (!value.startsAt || !value.endsAt) return true;
  return new Date(value.startsAt).getTime() <= new Date(value.endsAt).getTime();
}, "展示位开始时间不能晚于结束时间");

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug 为必填项")
  .max(180, "Slug 过长")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "请使用小写字母、数字和连字符");

export const loginSchema = z.object({
  email: z.string().trim().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少需要 8 个字符")
});

export const postSchema = z.object({
  writingRole: z.enum(aiWritingRoleIds).optional(),
  slug: slugSchema,
  categoryId: z.string().uuid("请选择分类"),
  status: z.enum(["draft", "published", "archived"]),
  mark: z.enum(["", "featured", "pinned", "sponsored"]),
  coverImageId: z.string().uuid("请选择有效的封面图片").or(z.literal("")),
  coverImageUrl: z.string().trim().url("请输入有效的封面图片 URL").or(z.literal("")),
  coverImageAlt: z.string().trim().max(255).optional(),
  enSeoTitle: z.string().trim().max(255).optional(),
  enSeoDescription: z.string().trim().max(500).optional(),
  enCanonicalUrl: z.string().trim().url("请输入有效的英文 canonical URL").or(z.literal("")),
  enOgImage: z.string().trim().url("请输入有效的英文 OG 图片 URL").or(z.literal("")),
  enStructuredData: z.string().trim().max(12000, "英文结构化数据不能超过 12000 个字符").optional(),
  zhSeoTitle: z.string().trim().max(255).optional(),
  zhSeoDescription: z.string().trim().max(500).optional(),
  zhCanonicalUrl: z.string().trim().url("请输入有效的中文 canonical URL").or(z.literal("")),
  zhOgImage: z.string().trim().url("请输入有效的中文 OG 图片 URL").or(z.literal("")),
  zhStructuredData: z.string().trim().max(12000, "中文结构化数据不能超过 12000 个字符").optional(),
  publishedAt: z.string().optional(),
  publishedAtTimezoneOffset: z.string().optional(),
  publishedAtTimeZone: z.string().trim().max(120).optional(),
  featured: z.boolean().optional(),
  pinned: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  tagIds: z.array(z.string().uuid()).default([]),
  enTitle: z.string().trim().min(1, "英文标题为必填项").max(255),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().min(1, "英文正文为必填项"),
  zhTitle: z.string().trim().max(255).optional(),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().optional()
});

export const postPlacementSchema = z.object({
  postId: z.string().uuid("请选择文章"),
  placements: z.object({
    homeFeatured: placementSchema,
    homePromoted: placementSchema,
    categoryFeatured: placementSchema,
    categoryPromoted: placementSchema
  })
});

export const newPostSchema = postSchema.extend({
  writingRole: z.enum(aiWritingRoleIds).optional(),
  slug: slugSchema.or(z.literal("")),
  enTitle: z.string().trim().max(255).optional(),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().optional(),
  zhTitle: z.string().trim().min(1, "中文标题为必填项").max(255),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().min(1, "中文正文为必填项")
});

export const categorySchema = z.object({
  enSeoTitle: z.string().trim().max(255).optional(),
  enSeoDescription: z.string().trim().max(500).optional(),
  zhSeoTitle: z.string().trim().max(255).optional(),
  zhSeoDescription: z.string().trim().max(500).optional(),
  enName: z.string().trim().min(1, "英文名称为必填项").max(160),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().min(1, "中文名称为必填项").max(160),
  zhDescription: z.string().trim().optional()
});

export const tagSchema = z.object({
  slug: slugSchema.max(140),
  enSeoTitle: z.string().trim().max(255).optional(),
  enSeoDescription: z.string().trim().max(500).optional(),
  zhSeoTitle: z.string().trim().max(255).optional(),
  zhSeoDescription: z.string().trim().max(500).optional(),
  enName: z.string().trim().min(1, "英文名称为必填项").max(120),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().min(1, "中文名称为必填项").max(120),
  zhDescription: z.string().trim().optional()
});

export const userSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(160),
  password: z.string().min(10, "密码至少需要 10 个字符"),
  role: z.enum(["admin", "editor"])
});

export const aiSettingsSchema = z.object({
  apiKey: z.string().trim().optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "请输入有效的 API Base URL"),
  model: z.string().trim().min(1, "模型为必填项").max(120),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(5000, "超时时间至少为 5000 毫秒")
    .max(180000, "超时时间不能超过 180000 毫秒")
});

export const imageGenerationSettingsSchema = z.object({
  apiKey: z.string().trim().optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "请输入有效的图片生成 API Base URL"),
  model: z.string().trim().min(1, "图片生成模型为必填项").max(120),
  preset: z.enum(imageGenerationPresetValues),
  size: z.enum(["auto", "1024x1024", "1024x1536", "1536x1024"]),
  quality: z.enum(["auto", "low", "medium", "high"]),
  outputFormat: z.enum(["png", "jpeg", "webp"]),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(10000, "图片生成超时时间至少为 10000 毫秒")
    .max(300000, "图片生成超时时间不能超过 300000 毫秒"),
  blockchainPromptStyle: z
    .string()
    .trim()
    .max(2000, "区块链封面生成风格不能超过 2000 个字符")
    .optional(),
  aiPromptStyle: z
    .string()
    .trim()
    .max(2000, "人工智能封面生成风格不能超过 2000 个字符")
    .optional(),
  infrastructurePromptStyle: z
    .string()
    .trim()
    .max(2000, "基础设施封面生成风格不能超过 2000 个字符")
    .optional()
});

export const writingStyleSchema = z.object({
  writingStyle: z.string().trim().max(2000, "写作风格不能超过 2000 个字符").optional(),
  defaultWritingRole: z.enum(aiWritingRoleIds),
  zhSeoStyle: z
    .string()
    .trim()
    .max(2000, "中文 SEO 风格不能超过 2000 个字符")
    .optional(),
  enSeoStyle: z
    .string()
    .trim()
    .max(2000, "英文 SEO 风格不能超过 2000 个字符")
    .optional(),
  writingRoleStyles: z.record(
    z.enum(aiWritingRoleIds),
    z.string().trim().max(2000, "角色风格不能超过 2000 个字符")
  )
});

export const aiSeoStyleSettingsSchema = z.object({
  zhSeoStyle: z
    .string()
    .trim()
    .max(2000, "中文 SEO 风格不能超过 2000 个字符")
    .optional(),
  enSeoStyle: z
    .string()
    .trim()
    .max(2000, "英文 SEO 风格不能超过 2000 个字符")
    .optional()
});

export const aiDraftRewriteSchema = z
  .object({
    writingRole: z.enum(aiWritingRoleIds).optional(),
    rawInput: z.string().trim().max(20000, "原始素材不能超过 20000 个字符").optional(),
    sourceUrl: z
      .string()
      .trim()
      .url("请输入有效的网页或视频链接")
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "链接必须以 http:// 或 https:// 开头")
      .or(z.literal(""))
      .optional()
  })
  .refine(
    (value) =>
      Boolean(value.sourceUrl?.trim()) || Boolean(value.rawInput?.trim().length),
    "请先输入原始素材，或提供一个网页/视频链接"
  )
  .refine(
    (value) =>
      Boolean(value.sourceUrl?.trim()) ||
      Boolean(value.rawInput && value.rawInput.trim().length >= 20),
    "如果不提供链接，请先输入至少 20 个字符的原始素材"
  );

export const aiDraftTranslateSchema = z.object({
  writingRole: z.enum(aiWritingRoleIds).optional(),
  zhTitle: z.string().trim().min(1, "中文标题为必填项").max(255),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().min(1, "中文正文为必填项")
});

export const aiDraftMetadataSchema = z.object({
  writingRole: z.enum(aiWritingRoleIds).optional(),
  zhTitle: z.string().trim().min(1, "中文标题为必填项").max(255),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().min(1, "中文正文为必填项"),
  enTitle: z.string().trim().min(1, "英文标题为必填项").max(255),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().min(1, "英文正文为必填项")
});

export const homepageSeoSchema = z.object({
  enTitle: z.string().trim().max(255).optional(),
  enDescription: z.string().trim().max(500).optional(),
  enKeywords: z.string().trim().max(500).optional(),
  enOgTitle: z.string().trim().max(255).optional(),
  enOgDescription: z.string().trim().max(500).optional(),
  zhTitle: z.string().trim().max(255).optional(),
  zhDescription: z.string().trim().max(500).optional(),
  zhKeywords: z.string().trim().max(500).optional(),
  zhOgTitle: z.string().trim().max(255).optional(),
  zhOgDescription: z.string().trim().max(500).optional(),
  ogImage: z.string().trim().url("请输入有效的 Open Graph 图片 URL").or(z.literal("")),
  canonicalUrl: z.string().trim().url("请输入有效的 canonical URL").or(z.literal(""))
});

export const seoSuggestionSchema = z
  .object({
    targetType: z.enum(["homepage", "category", "tag", "post"]),
    enTitle: z.string().trim().max(255).optional(),
    enDescription: z.string().trim().optional(),
    enContent: z.string().trim().optional(),
    zhTitle: z.string().trim().max(255).optional(),
    zhDescription: z.string().trim().optional(),
    zhContent: z.string().trim().optional(),
    keywords: z.string().trim().optional()
  })
  .refine((value) => value.enTitle || value.zhTitle, {
    message: "请先填写英文或中文标题/名称"
  });

export const bulkPostSeoSchema = z.object({
  postIds: z.array(z.string().uuid()).min(1, "请选择需要生成 SEO 的文章").max(20, "一次最多处理 20 篇文章")
});

export const mediaAssetSchema = z.object({
  url: z.string().trim().url("请输入有效的图片 URL"),
  altText: z.string().trim().max(255).optional(),
  caption: z.string().trim().optional(),
  zhAltText: z.string().trim().max(255, "中文替代文本不能超过 255 个字符").optional(),
  enAltText: z.string().trim().max(255, "英文替代文本不能超过 255 个字符").optional(),
  zhSeoTitle: z.string().trim().max(255, "中文 SEO 标题不能超过 255 个字符").optional(),
  zhSeoDescription: z
    .string()
    .trim()
    .max(500, "中文 SEO 描述不能超过 500 个字符")
    .optional(),
  enSeoTitle: z.string().trim().max(255, "英文 SEO 标题不能超过 255 个字符").optional(),
  enSeoDescription: z
    .string()
    .trim()
    .max(500, "英文 SEO 描述不能超过 500 个字符")
    .optional()
});
