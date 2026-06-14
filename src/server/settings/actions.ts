"use server";

import { revalidatePath } from "next/cache";

import {
  aiSettingsSchema,
  homepageSeoSchema,
  writingStyleSchema
} from "@/lib/validators";
import { aiWritingRoles } from "@/lib/ai-style";
import { generateSeoSuggestion } from "@/server/ai/openai";
import { requireContentEditor, requireRole } from "@/server/auth/session";
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
  const parsedStyle = writingStyleSchema.safeParse({
    writingStyle: stringValue(formData, "writingStyle"),
    defaultWritingRole: stringValue(formData, "defaultWritingRole"),
    zhSeoStyle: stringValue(formData, "zhSeoStyle"),
    enSeoStyle: stringValue(formData, "enSeoStyle"),
    writingRoleStyles: Object.fromEntries(
      aiWritingRoles.map((role) => [
        role.id,
        stringValue(formData, `writingRoleStyle.${role.id}`)
      ])
    )
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 设置无效" };
  }
  if (!parsedStyle.success) {
    return { error: parsedStyle.error.issues[0]?.message ?? "AI 写作风格无效" };
  }

  await saveAiSettings({
    apiKey: parsed.data.apiKey,
    apiBaseUrl: parsed.data.apiBaseUrl,
    model: parsed.data.model,
    timeoutMs: parsed.data.timeoutMs,
    writingStyle: parsedStyle.data.writingStyle,
    defaultWritingRole: parsedStyle.data.defaultWritingRole,
    writingRoleStyles: parsedStyle.data.writingRoleStyles,
    zhSeoStyle: parsedStyle.data.zhSeoStyle,
    enSeoStyle: parsedStyle.data.enSeoStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 设置已保存。" };
}

export async function updateHomepageSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireContentEditor();
  const parsed = homepageSeoSchema.safeParse({
    enTitle: stringValue(formData, "enTitle"),
    enDescription: stringValue(formData, "enDescription"),
    enKeywords: stringValue(formData, "enKeywords"),
    enOgTitle: stringValue(formData, "enOgTitle"),
    enOgDescription: stringValue(formData, "enOgDescription"),
    zhTitle: stringValue(formData, "zhTitle"),
    zhDescription: stringValue(formData, "zhDescription"),
    zhKeywords: stringValue(formData, "zhKeywords"),
    zhOgTitle: stringValue(formData, "zhOgTitle"),
    zhOgDescription: stringValue(formData, "zhOgDescription"),
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
  suggestion?: Awaited<ReturnType<typeof generateSeoSuggestion>>;
}> {
  await requireContentEditor();

  try {
    const suggestion = await generateSeoSuggestion({
      targetType: "homepage",
      enTitle: stringValue(formData, "enTitle") || "BSVgo Blog",
      enDescription: stringValue(formData, "enDescription"),
      zhTitle: stringValue(formData, "zhTitle") || "BSVgo 博客",
      zhDescription: stringValue(formData, "zhDescription"),
      keywords:
        stringValue(formData, "enKeywords") ||
        stringValue(formData, "zhKeywords")
    });

    return {
      success: "AI 已生成首页 SEO 建议，请检查后保存。",
      suggestion
    };
  } catch {
    return { error: "AI 生成 SEO 建议失败。请检查 AI 设置后重试。" };
  }
}
