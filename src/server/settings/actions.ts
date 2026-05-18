"use server";

import { revalidatePath } from "next/cache";

import { aiSettingsSchema, homepageSeoSchema } from "@/lib/validators";
import { generateSeoSuggestion } from "@/server/ai/openai";
import { requireRole } from "@/server/auth/session";
import {
  saveAiSettings,
  saveHomepageSeoSettings
} from "@/server/settings/service";

type ActionState = {
  error?: string;
  success?: string;
};

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function updateAiSettingsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = aiSettingsSchema.safeParse({
    apiKey: stringValue(formData, "apiKey"),
    apiBaseUrl: stringValue(formData, "apiBaseUrl"),
    model: stringValue(formData, "model"),
    timeoutMs: stringValue(formData, "timeoutMs")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 设置无效" };
  }

  await saveAiSettings({
    apiKey: parsed.data.apiKey,
    apiBaseUrl: parsed.data.apiBaseUrl,
    model: parsed.data.model,
    timeoutMs: parsed.data.timeoutMs,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 设置已保存。" };
}

export async function updateHomepageSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = homepageSeoSchema.safeParse({
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    keywords: stringValue(formData, "keywords"),
    ogTitle: stringValue(formData, "ogTitle"),
    ogDescription: stringValue(formData, "ogDescription"),
    ogImage: stringValue(formData, "ogImage"),
    canonicalUrl: stringValue(formData, "canonicalUrl")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "首页 SEO 设置无效" };
  }

  await saveHomepageSeoSettings({
    ...parsed.data,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "首页 SEO 设置已保存。" };
}

export async function generateHomepageSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState & {
  suggestion?: {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
  };
}> {
  await requireRole(["admin"]);

  try {
    const suggestion = await generateSeoSuggestion({
      targetType: "homepage",
      title: stringValue(formData, "title") || "BSVgo Blog",
      description: stringValue(formData, "description"),
      keywords: stringValue(formData, "keywords")
    });

    return {
      success: "AI 已生成首页 SEO 建议，请检查后保存。",
      suggestion
    };
  } catch {
    return { error: "AI 生成 SEO 建议失败。请检查 AI 设置后重试。" };
  }
}
