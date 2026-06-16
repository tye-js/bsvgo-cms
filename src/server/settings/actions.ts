"use server";

import { revalidatePath } from "next/cache";

import {
  aiSeoStyleSettingsSchema,
  aiSettingsSchema,
  homepageSeoSchema,
  imageGenerationSettingsSchema,
  writingStyleSchema
} from "@/lib/validators";
import { aiWritingRoles } from "@/lib/ai-style";
import { generateSeoSuggestion } from "@/server/ai/openai";
import { requireContentEditor, requireRole } from "@/server/auth/session";
import {
  saveAiSettings,
  saveImageGenerationSettings,
  saveHomepageSeoSettings
} from "@/server/settings/service";

type ActionState = {
  error?: string;
  success?: string;
};

export type AiProviderSettingsInput = {
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: string;
};

export type AiWritingSettingsInput = {
  writingStyle?: string;
  defaultWritingRole: string;
  writingRoleStyles: Record<string, string>;
};

export type AiSeoStyleSettingsInput = {
  zhSeoStyle?: string;
  enSeoStyle?: string;
};

export type ImageGenerationSettingsInput = {
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  size: string;
  quality: string;
  outputFormat: string;
  timeoutMs: string;
  blockchainPromptStyle?: string;
  aiPromptStyle?: string;
  infrastructurePromptStyle?: string;
};

export type HomepageSeoSettingsInput = {
  enTitle?: string;
  enDescription?: string;
  enKeywords?: string;
  enOgTitle?: string;
  enOgDescription?: string;
  zhTitle?: string;
  zhDescription?: string;
  zhKeywords?: string;
  zhOgTitle?: string;
  zhOgDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
};

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function homepageSeoInputFromFormData(
  formData: FormData
): HomepageSeoSettingsInput {
  return {
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
  };
}

async function currentAiSettingsForPreserve() {
  const settings = await import("@/server/settings/service").then((module) =>
    module.getSettingsPageData()
  );

  return {
    writingStyle: settings.ai.writingStyle,
    defaultWritingRole: settings.ai.defaultWritingRole,
    writingRoleStyles: Object.fromEntries(
      settings.ai.writingRoles.map((role) => [role.id, role.style])
    ),
    zhSeoStyle: settings.ai.zhSeoStyle,
    enSeoStyle: settings.ai.enSeoStyle
  };
}

export async function updateAiProviderSettingsAction(
  input: AiProviderSettingsInput
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 模型连接设置无效" };
  }

  const preserved = await currentAiSettingsForPreserve();
  await saveAiSettings({
    apiKey: parsed.data.apiKey,
    apiBaseUrl: parsed.data.apiBaseUrl,
    model: parsed.data.model,
    timeoutMs: parsed.data.timeoutMs,
    ...preserved,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "文本生成模型连接已保存。" };
}

export async function updateAiWritingSettingsAction(
  input: AiWritingSettingsInput
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const preserved = await currentAiSettingsForPreserve();
  const parsed = writingStyleSchema.safeParse({
    writingStyle: input.writingStyle,
    defaultWritingRole: input.defaultWritingRole,
    zhSeoStyle: preserved.zhSeoStyle,
    enSeoStyle: preserved.enSeoStyle,
    writingRoleStyles: Object.fromEntries(
      aiWritingRoles.map((role) => [
        role.id,
        input.writingRoleStyles[role.id] ?? ""
      ])
    )
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 写作策略无效" };
  }

  const settings = await import("@/server/settings/service").then((module) =>
    module.getSettingsPageData()
  );
  await saveAiSettings({
    apiBaseUrl: settings.ai.apiBaseUrl,
    model: settings.ai.model,
    timeoutMs: Number(settings.ai.timeoutMs),
    writingStyle: parsed.data.writingStyle,
    defaultWritingRole: parsed.data.defaultWritingRole,
    writingRoleStyles: parsed.data.writingRoleStyles,
    zhSeoStyle: preserved.zhSeoStyle,
    enSeoStyle: preserved.enSeoStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 写作策略已保存。" };
}

export async function updateAiSeoStyleSettingsAction(
  input: AiSeoStyleSettingsInput
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = aiSeoStyleSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI SEO 策略无效" };
  }

  const settings = await import("@/server/settings/service").then((module) =>
    module.getSettingsPageData()
  );
  await saveAiSettings({
    apiBaseUrl: settings.ai.apiBaseUrl,
    model: settings.ai.model,
    timeoutMs: Number(settings.ai.timeoutMs),
    writingStyle: settings.ai.writingStyle,
    defaultWritingRole: settings.ai.defaultWritingRole,
    writingRoleStyles: Object.fromEntries(
      settings.ai.writingRoles.map((role) => [role.id, role.style])
    ),
    zhSeoStyle: parsed.data.zhSeoStyle,
    enSeoStyle: parsed.data.enSeoStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI SEO 策略已保存。" };
}

export async function updateImageGenerationSettingsAction(
  input: ImageGenerationSettingsInput
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = imageGenerationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "AI 图片生成设置无效"
    };
  }

  await saveImageGenerationSettings({
    apiKey: parsed.data.apiKey,
    apiBaseUrl: parsed.data.apiBaseUrl,
    model: parsed.data.model,
    size: parsed.data.size,
    quality: parsed.data.quality,
    outputFormat: parsed.data.outputFormat,
    timeoutMs: parsed.data.timeoutMs,
    blockchainPromptStyle: parsed.data.blockchainPromptStyle,
    aiPromptStyle: parsed.data.aiPromptStyle,
    infrastructurePromptStyle: parsed.data.infrastructurePromptStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 图片生成设置已保存。" };
}

export async function saveHomepageSeoSettingsAction(
  input: HomepageSeoSettingsInput
): Promise<ActionState> {
  const user = await requireContentEditor();
  const parsed = homepageSeoSchema.safeParse(input);

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

export async function generateHomepageSeoSuggestionAction(
  input: HomepageSeoSettingsInput
): Promise<ActionState & {
  suggestion?: Awaited<ReturnType<typeof generateSeoSuggestion>>;
}> {
  await requireContentEditor();

  try {
    const suggestion = await generateSeoSuggestion({
      targetType: "homepage",
      enTitle: input.enTitle || "BSVgo Blog",
      enDescription: input.enDescription || "",
      zhTitle: input.zhTitle || "BSVgo 博客",
      zhDescription: input.zhDescription || "",
      keywords: input.enKeywords || input.zhKeywords || ""
    });

    return {
      success: "AI 已生成首页 SEO 建议，请检查后保存。",
      suggestion
    };
  } catch {
    return { error: "AI 生成 SEO 建议失败。请检查 AI 设置后重试。" };
  }
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
  const parsedImageGeneration = imageGenerationSettingsSchema.safeParse({
    apiKey: stringValue(formData, "imageApiKey"),
    apiBaseUrl: stringValue(formData, "imageApiBaseUrl"),
    model: stringValue(formData, "imageModel"),
    size: stringValue(formData, "imageSize"),
    quality: stringValue(formData, "imageQuality"),
    outputFormat: stringValue(formData, "imageOutputFormat"),
    timeoutMs: stringValue(formData, "imageTimeoutMs"),
    blockchainPromptStyle: stringValue(formData, "imageBlockchainPromptStyle"),
    aiPromptStyle: stringValue(formData, "imageAiPromptStyle"),
    infrastructurePromptStyle: stringValue(
      formData,
      "imageInfrastructurePromptStyle"
    )
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 设置无效" };
  }
  if (!parsedStyle.success) {
    return { error: parsedStyle.error.issues[0]?.message ?? "AI 写作风格无效" };
  }
  if (!parsedImageGeneration.success) {
    return {
      error:
        parsedImageGeneration.error.issues[0]?.message ?? "AI 图片生成设置无效"
    };
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
  await saveImageGenerationSettings({
    apiKey: parsedImageGeneration.data.apiKey,
    apiBaseUrl: parsedImageGeneration.data.apiBaseUrl,
    model: parsedImageGeneration.data.model,
    size: parsedImageGeneration.data.size,
    quality: parsedImageGeneration.data.quality,
    outputFormat: parsedImageGeneration.data.outputFormat,
    timeoutMs: parsedImageGeneration.data.timeoutMs,
    blockchainPromptStyle: parsedImageGeneration.data.blockchainPromptStyle,
    aiPromptStyle: parsedImageGeneration.data.aiPromptStyle,
    infrastructurePromptStyle:
      parsedImageGeneration.data.infrastructurePromptStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 设置已保存。" };
}

export async function updateHomepageSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  return saveHomepageSeoSettingsAction(homepageSeoInputFromFormData(formData));
}

export async function generateHomepageSeoAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState & {
  suggestion?: Awaited<ReturnType<typeof generateSeoSuggestion>>;
}> {
  return generateHomepageSeoSuggestionAction(homepageSeoInputFromFormData(formData));
}
