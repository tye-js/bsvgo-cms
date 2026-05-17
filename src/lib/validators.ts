import { z } from "zod";

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
  slug: slugSchema,
  categoryId: z.string().uuid("请选择分类"),
  status: z.enum(["draft", "published", "archived"]),
  coverImageUrl: z.string().trim().url("请输入有效的封面图片 URL").or(z.literal("")),
  coverImageAlt: z.string().trim().max(255).optional(),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  publishedAt: z.string().optional(),
  featured: z.boolean(),
  pinned: z.boolean(),
  readingTimeMinutes: z.coerce.number().int().min(1).max(240),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  tagIds: z.array(z.string().uuid()).default([]),
  enTitle: z.string().trim().min(1, "英文标题为必填项").max(255),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().min(1, "英文正文为必填项"),
  zhTitle: z.string().trim().max(255).optional(),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().optional()
});

export const newPostSchema = postSchema.extend({
  enTitle: z.string().trim().optional(),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().optional(),
  zhTitle: z.string().trim().min(1, "中文标题为必填项").max(255),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().min(1, "中文正文为必填项")
});

export const categorySchema = z.object({
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  enName: z.string().trim().min(1, "英文名称为必填项").max(160),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().min(1, "中文名称为必填项").max(160),
  zhDescription: z.string().trim().optional()
});

export const tagSchema = z.object({
  slug: slugSchema.max(140),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  enName: z.string().trim().min(1, "英文名称为必填项").max(120),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().optional(),
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

export const mediaAssetSchema = z.object({
  url: z.string().trim().url("请输入有效的图片 URL"),
  altText: z.string().trim().max(255).optional(),
  caption: z.string().trim().optional()
});
