import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(180, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const postSchema = z.object({
  slug: slugSchema,
  categoryId: z.string().uuid("Choose a category"),
  status: z.enum(["draft", "published", "archived"]),
  coverImageUrl: z.string().trim().url("Enter a valid cover image URL").or(z.literal("")),
  coverImageAlt: z.string().trim().max(255).optional(),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  publishedAt: z.string().optional(),
  featured: z.boolean(),
  pinned: z.boolean(),
  readingTimeMinutes: z.coerce.number().int().min(1).max(240),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  tagIds: z.array(z.string().uuid()).default([]),
  enTitle: z.string().trim().min(1, "English title is required").max(255),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().min(1, "English content is required"),
  zhTitle: z.string().trim().max(255).optional(),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().optional()
});

export const newPostSchema = postSchema.extend({
  enTitle: z.string().trim().optional(),
  enExcerpt: z.string().trim().optional(),
  enContent: z.string().trim().optional(),
  zhTitle: z.string().trim().min(1, "Chinese title is required").max(255),
  zhExcerpt: z.string().trim().optional(),
  zhContent: z.string().trim().min(1, "Chinese content is required")
});

export const categorySchema = z.object({
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  enName: z.string().trim().min(1, "English name is required").max(160),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().min(1, "Chinese name is required").max(160),
  zhDescription: z.string().trim().optional()
});

export const tagSchema = z.object({
  slug: slugSchema.max(140),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().optional(),
  enName: z.string().trim().min(1, "English name is required").max(120),
  enDescription: z.string().trim().optional(),
  zhName: z.string().trim().optional(),
  zhDescription: z.string().trim().optional()
});

export const userSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(160),
  password: z.string().min(10, "Password must be at least 10 characters"),
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
    }, "Enter a valid API base URL"),
  model: z.string().trim().min(1, "Model is required").max(120),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(5000, "Timeout must be at least 5000 ms")
    .max(180000, "Timeout must be no more than 180000 ms")
});

export const mediaAssetSchema = z.object({
  url: z.string().trim().url("Enter a valid image URL"),
  altText: z.string().trim().max(255).optional(),
  caption: z.string().trim().optional()
});
