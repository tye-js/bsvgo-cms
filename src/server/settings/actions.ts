"use server";

import { revalidatePath } from "next/cache";

import {
  aiJobSettingsSchema,
  aiSeoStyleSettingsSchema,
  aiSettingsSchema,
  homepageSeoSchema,
  imageGenerationSettingsSchema,
  writingStyleSchema
} from "@/lib/validators";
import { aiWritingRoles } from "@/lib/ai-style";
import { MAIN_COVER_IMAGE_SPEC } from "@/lib/image-generation";
import { generateSeoSuggestion } from "@/server/ai/openai";
import { requireContentEditor, requireRole } from "@/server/auth/session";
import {
  saveAiSettings,
  getSavedAiProviderSecret,
  getSavedImageGenerationSecret,
  saveAiJobSettings,
  saveImageGenerationSettings,
  saveHomepageSeoSettings
} from "@/server/settings/service";

type ActionState = {
  error?: string;
  success?: string;
};

export type AiSettingsDiagnostic = {
  provider: string;
  endpoint: string;
  model: string;
  httpStatus: number | null;
  elapsedMs: number;
  compatible: boolean;
  responseText: string;
  rawResponse: string;
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
  preset: string;
  size: string;
  quality: string;
  outputFormat: string;
  blockchainPromptStyle?: string;
  aiPromptStyle?: string;
  infrastructurePromptStyle?: string;
};

export type AiJobSettingsInput = {
  succeededSingleRetentionDays: string;
  succeededBulkRetentionDays: string;
  failedRetentionDays: string;
  defaultRecentDays: string;
};

type DiagnosticActionState = ActionState & {
  diagnostic?: AiSettingsDiagnostic;
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

function normalizeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.trim().replace(/\/+$/, "");
}

function responsesUrl(apiBaseUrl: string) {
  const normalized = normalizeBaseUrl(apiBaseUrl);
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function chatCompletionsUrl(apiBaseUrl: string) {
  const normalized = normalizeBaseUrl(apiBaseUrl);
  if (normalized.endsWith("/chat/completions")) return normalized;
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function imageGenerationsUrl(apiBaseUrl: string) {
  const normalized = normalizeBaseUrl(apiBaseUrl);
  if (normalized.endsWith("/images/generations")) return normalized;
  return normalized.endsWith("/v1")
    ? `${normalized}/images/generations`
    : `${normalized}/v1/images/generations`;
}

function isResponsesProvider(apiBaseUrl: string) {
  return apiBaseUrl.includes("api.openai.com") || apiBaseUrl.endsWith("/responses");
}

function isDeepSeekProvider(apiBaseUrl: string) {
  return apiBaseUrl.toLowerCase().includes("deepseek.com");
}

function isDeepSeekV4Model(model: string) {
  return model.trim().toLowerCase().startsWith("deepseek-v4");
}

function deepSeekChatOptions(apiBaseUrl: string, model: string) {
  if (!isDeepSeekProvider(apiBaseUrl) || !isDeepSeekV4Model(model)) return {};
  return {
    thinking: { type: "disabled" }
  };
}

function providerLabel(apiBaseUrl: string) {
  if (apiBaseUrl.includes("deepseek.com")) return "DeepSeek";
  if (apiBaseUrl.includes("api.openai.com")) return "OpenAI";
  return "AI provider";
}

function truncateText(value: string, maxLength = 4000) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n... 已截断 ${value.length - maxLength} 个字符`;
}

function safePayloadPreview(payload: unknown) {
  return truncateText(
    JSON.stringify(
      payload,
      (key, value) => {
        if (key === "b64_json" && typeof value === "string") {
          return `[base64 image data: ${value.length} chars]`;
        }
        return value;
      },
      2
    )
  );
}

function chatOutputText(payload: unknown) {
  const record = payload as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return record.choices?.[0]?.message?.content ?? "";
}

function responsesOutputText(payload: unknown) {
  const record = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  return (
    record.output_text ??
    record.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .filter(Boolean)
      .join("\n") ??
    ""
  );
}

function diagnosticErrorMessage(responseText: string, status: number) {
  const normalized = responseText.replace(/\s+/g, " ").trim();
  if (!normalized) return `模型测试失败：HTTP ${status}`;
  return `模型测试失败：HTTP ${status} ${truncateText(normalized, 500)}`;
}

export async function testAiProviderSettingsAction(
  input: AiProviderSettingsInput
): Promise<DiagnosticActionState> {
  await requireRole(["admin"]);
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "AI 模型连接设置无效" };
  }

  const apiKey =
    parsed.data.apiKey?.trim() || (await getSavedAiProviderSecret());
  if (!apiKey) {
    return { error: "请先填写并保存文本 API Key，或在测试前临时输入 API Key。" };
  }

  const provider = isResponsesProvider(parsed.data.apiBaseUrl)
    ? "Responses API"
    : "Chat Completions";
  const endpoint =
    provider === "Responses API"
      ? responsesUrl(parsed.data.apiBaseUrl)
      : chatCompletionsUrl(parsed.data.apiBaseUrl);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), parsed.data.timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body:
        provider === "Responses API"
          ? JSON.stringify({
              model: parsed.data.model,
              input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text",
                      text:
                        'Return exactly one short JSON object like {"ok":true,"message":"BSVgo CMS text model test passed"}.'
                    }
                  ]
                }
              ]
            })
          : JSON.stringify({
              model: parsed.data.model,
              ...deepSeekChatOptions(parsed.data.apiBaseUrl, parsed.data.model),
              messages: [
                {
                  role: "user",
                  content:
                    'Return exactly one short JSON object like {"ok":true,"message":"BSVgo CMS text model test passed"}.'
                }
              ],
              response_format: { type: "json_object" }
            })
    });
    const elapsedMs = Date.now() - startedAt;
    const rawText = await response.text();
    let payload: unknown = rawText;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }

    const responseText =
      provider === "Responses API"
        ? responsesOutputText(payload)
        : chatOutputText(payload);
    const diagnostic = {
      provider,
      endpoint,
      model: parsed.data.model,
      httpStatus: response.status,
      elapsedMs,
      compatible: response.ok,
      responseText: truncateText(responseText || rawText, 1000),
      rawResponse: safePayloadPreview(payload)
    };

    if (!response.ok) {
      return {
        error: diagnosticErrorMessage(rawText, response.status),
        diagnostic
      };
    }

    return {
      success: `${providerLabel(parsed.data.apiBaseUrl)} 文本模型测试成功。`,
      diagnostic
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return {
      error:
        error instanceof Error && error.name === "AbortError"
          ? "文本模型测试超时，请检查 Base URL、模型名、Key 或供应商账号状态。"
          : error instanceof Error
            ? error.message
            : "文本模型测试失败。",
      diagnostic: {
        provider,
        endpoint,
        model: parsed.data.model,
        httpStatus: null,
        elapsedMs,
        compatible: false,
        responseText: "",
        rawResponse: ""
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function testImageGenerationSettingsAction(
  input: ImageGenerationSettingsInput
): Promise<DiagnosticActionState> {
  await requireRole(["admin"]);
  const parsed = imageGenerationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "AI 图片生成设置无效"
    };
  }

  const apiKey =
    parsed.data.apiKey?.trim() ||
    (await getSavedImageGenerationSecret(parsed.data.apiBaseUrl));
  if (!apiKey) {
    return {
      error:
        "请先填写并保存图片 API Key，或在测试前临时输入图片 API Key。图片供应商与文本供应商不同时不能复用文本 Key。"
    };
  }

  const endpoint = imageGenerationsUrl(parsed.data.apiBaseUrl);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), 180000);
  const size =
    parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
      ? MAIN_COVER_IMAGE_SPEC.sourceSize
      : parsed.data.size;
  const quality =
    parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
      ? "high"
      : parsed.data.quality;
  const outputFormat =
    parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
      ? MAIN_COVER_IMAGE_SPEC.providerOutputFormat
      : parsed.data.outputFormat;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: parsed.data.model,
        prompt:
          "BSVgo CMS image model connection test. Create a clean abstract technology blog cover with no readable text, no logos, and a professional editorial style.",
        n: 1,
        size,
        quality,
        output_format: outputFormat,
        response_format: "b64_json"
      })
    });
    const elapsedMs = Date.now() - startedAt;
    const rawText = await response.text();
    let payload: unknown = rawText;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
    const firstImage = (payload as { data?: Array<Record<string, unknown>> }).data?.[0];
    const imageSource =
      typeof firstImage?.b64_json === "string"
        ? `收到 base64 图片数据，长度 ${firstImage.b64_json.length}`
        : typeof firstImage?.url === "string"
          ? `收到图片 URL：${firstImage.url}`
          : rawText;
    const diagnostic = {
      provider: "Images Generations",
      endpoint,
      model: parsed.data.model,
      httpStatus: response.status,
      elapsedMs,
      compatible: response.ok,
      responseText: truncateText(imageSource, 1000),
      rawResponse: safePayloadPreview(payload)
    };

    if (!response.ok) {
      return {
        error: diagnosticErrorMessage(rawText, response.status),
        diagnostic
      };
    }

    return {
      success: "图片生成模型测试成功。",
      diagnostic
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return {
      error:
        error instanceof Error && error.name === "AbortError"
          ? "图片模型测试超时，请检查 Base URL、模型名、Key、尺寸规格或供应商账号状态。"
          : error instanceof Error
            ? error.message
            : "图片模型测试失败。",
      diagnostic: {
        provider: "Images Generations",
        endpoint,
        model: parsed.data.model,
        httpStatus: null,
        elapsedMs,
        compatible: false,
        responseText: "",
        rawResponse: ""
      }
    };
  } finally {
    clearTimeout(timer);
  }
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
    preset: parsed.data.preset,
    size:
      parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? MAIN_COVER_IMAGE_SPEC.sourceSize
        : parsed.data.size,
    quality:
      parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? "high"
        : parsed.data.quality,
    outputFormat:
      parsed.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? MAIN_COVER_IMAGE_SPEC.providerOutputFormat
        : parsed.data.outputFormat,
    blockchainPromptStyle: parsed.data.blockchainPromptStyle,
    aiPromptStyle: parsed.data.aiPromptStyle,
    infrastructurePromptStyle: parsed.data.infrastructurePromptStyle,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI 图片生成设置已保存。" };
}

export async function updateAiJobSettingsAction(
  input: AiJobSettingsInput
): Promise<ActionState> {
  const user = await requireRole(["admin"]);
  const parsed = aiJobSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "AI 任务保留设置无效"
    };
  }

  await saveAiJobSettings({
    ...parsed.data,
    userId: user.id
  });

  revalidatePath("/settings");
  revalidatePath("/ai/jobs");
  return { success: "AI 任务保留策略已保存。" };
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
    preset: stringValue(formData, "imagePreset") || "custom",
    size: stringValue(formData, "imageSize"),
    quality: stringValue(formData, "imageQuality"),
    outputFormat: stringValue(formData, "imageOutputFormat"),
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
    preset: parsedImageGeneration.data.preset,
    size:
      parsedImageGeneration.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? MAIN_COVER_IMAGE_SPEC.sourceSize
        : parsedImageGeneration.data.size,
    quality:
      parsedImageGeneration.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? "high"
        : parsedImageGeneration.data.quality,
    outputFormat:
      parsedImageGeneration.data.preset === MAIN_COVER_IMAGE_SPEC.preset
        ? MAIN_COVER_IMAGE_SPEC.providerOutputFormat
        : parsedImageGeneration.data.outputFormat,
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
