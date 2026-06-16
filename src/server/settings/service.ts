import "server-only";

import { inArray } from "drizzle-orm";

import {
  DEFAULT_AI_EN_SEO_STYLE,
  DEFAULT_AI_WRITING_ROLE_ID,
  DEFAULT_AI_ZH_SEO_STYLE,
  aiWritingRoles,
  getAiWritingRole,
  isAiWritingRoleId,
  type AiWritingRoleId
} from "@/lib/ai-style";
import {
  DEFAULT_IMAGE_GENERATION_PRESET,
  isImageGenerationPreset
} from "@/lib/image-generation";
import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";
import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";

export const AI_SETTING_KEYS = {
  apiKey: "ai.openai.api_key",
  apiBaseUrl: "ai.openai.api_base_url",
  model: "ai.openai.model",
  timeoutMs: "ai.openai.timeout_ms",
  writingStyle: "ai.openai.writing_style",
  defaultWritingRole: "ai.openai.default_writing_role",
  zhSeoStyle: "ai.openai.zh_seo_style",
  enSeoStyle: "ai.openai.en_seo_style"
} as const;

export const IMAGE_GENERATION_SETTING_KEYS = {
  apiKey: "ai.image.api_key",
  apiBaseUrl: "ai.image.api_base_url",
  model: "ai.image.model",
  preset: "ai.image.preset",
  size: "ai.image.size",
  quality: "ai.image.quality",
  outputFormat: "ai.image.output_format",
  timeoutMs: "ai.image.timeout_ms",
  promptStyle: "ai.image.prompt_style",
  blockchainPromptStyle: "ai.image.prompt_style.blockchain",
  aiPromptStyle: "ai.image.prompt_style.ai",
  infrastructurePromptStyle: "ai.image.prompt_style.infrastructure"
} as const;

export const HOMEPAGE_SEO_SETTING_KEYS = {
  en: {
    title: "seo.home.en.title",
    description: "seo.home.en.description",
    keywords: "seo.home.en.keywords",
    ogTitle: "seo.home.en.og_title",
    ogDescription: "seo.home.en.og_description"
  },
  zh: {
    title: "seo.home.zh.title",
    description: "seo.home.zh.description",
    keywords: "seo.home.zh.keywords",
    ogTitle: "seo.home.zh.og_title",
    ogDescription: "seo.home.zh.og_description"
  },
  ogImage: "seo.home.og_image",
  canonicalUrl: "seo.home.canonical_url"
} as const;

const LEGACY_HOMEPAGE_SEO_SETTING_KEYS = {
  title: "seo.home.title",
  description: "seo.home.description",
  keywords: "seo.home.keywords",
  ogTitle: "seo.home.og_title",
  ogDescription: "seo.home.og_description"
} as const;

export const DEFAULT_AI_API_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_AI_MODEL = "deepseek-v4-pro";
export const DEFAULT_AI_TIMEOUT_MS = 180000;
export const DEFAULT_IMAGE_API_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_IMAGE_SIZE = "1536x1024";
export const DEFAULT_IMAGE_QUALITY = "auto";
export const DEFAULT_IMAGE_OUTPUT_FORMAT = "png";
export const DEFAULT_IMAGE_TIMEOUT_MS = 180000;
export const DEFAULT_AI_WRITING_STYLE =
  "面向 BSVgo 技术读者，语言清晰、克制、可信。优先使用结构化小标题、短段落和 Markdown 正文，不输出 HTML。所有事实、数据、人物、时间、链接、代码、产品能力和因果判断必须来自素材或明确标注为推断；素材不足时要保守表达，不编造细节。允许适度营销，但必须具体、可验证、不过度承诺。中文正文自然专业，英文正文面向全球技术读者，避免中式直译。Slug 使用小写英文、数字和连字符，简短表达核心主题。SEO 要分别服务中文入口和英文入口，提炼真实关键词，不堆砌。";
const LEGACY_IMAGE_PROMPT_STYLE =
  "为 BSVgo 技术博客生成原创封面图。画面应专业、清晰、现代，适合区块链、BSV、AI、开发者工具和技术文章。避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。";
const LEGACY_IMAGE_BLOCKCHAIN_PROMPT_STYLE =
  "为 BSVgo 区块链类技术博客生成原创封面图。画面应体现 BSV、区块链系统、交易网络、数据结构、可扩展性和开发者工程感。风格专业、清晰、现代，避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。";
const LEGACY_IMAGE_AI_PROMPT_STYLE =
  "为 BSVgo 人工智能类技术博客生成原创封面图。画面应体现 AI 工作流、模型推理、自动化、数据处理和开发者工具感，与文章主题紧密相关。风格专业、克制、现代，避免文字、Logo、人物肖像、夸张科幻元素和误导性能力暗示。构图适合横向文章封面，留出标题覆盖空间。";
const LEGACY_IMAGE_INFRASTRUCTURE_PROMPT_STYLE =
  "为 BSVgo 基础设施类技术博客生成原创封面图。画面应体现云服务、节点、网络、数据库、安全、运维和产品基础设施。风格专业、清晰、可靠，避免文字、Logo、人物肖像、过度抽象装饰和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。";
export const DEFAULT_IMAGE_BLOCKCHAIN_PROMPT_STYLE =
  "为 BSVgo 区块链类文章生成一张专业、可信、具有传播吸引力的原创封面。画面要像高端技术媒体的头图，围绕文章标题和描述提炼一个清晰视觉主概念，突出 BSV、区块链网络、交易流、数据结构、可扩展系统或开发者工程场景。构图应有明确焦点、强缩略图识别度和社媒分享吸引力，适合横向文章封面和推广卡片；风格现代、精致、克制，有深度但不晦涩。避免可读文字、Logo、人物肖像、币价图、暴富暗示、夸张金融符号和廉价科幻感。";
export const DEFAULT_IMAGE_AI_PROMPT_STYLE =
  "为 BSVgo 人工智能类文章生成一张专业、前沿、容易被点击和转发的原创封面。画面要根据文章标题和描述定制视觉主题，体现 AI 模型、推理流程、自动化工作流、数据处理、智能代理或开发者工具的真实应用价值。构图应简洁有力量，具备清晰主视觉、层次感和推广海报级吸引力，适合技术读者在列表页和社交媒体中快速理解主题。风格现代、可信、精密，避免可读文字、Logo、人物肖像、夸张机器人脸、虚假能力暗示、过度赛博朋克和廉价炫光。";
export const DEFAULT_IMAGE_INFRASTRUCTURE_PROMPT_STYLE =
  "为 BSVgo 基础设施类文章生成一张专业、稳定、具有推广价值的原创封面。画面要根据文章标题和描述提炼基础设施核心卖点，表现云服务、节点网络、数据库、API、安全、监控、部署、扩展性或运维可靠性。构图应清晰、扎实、有可信的工程质感，适合横向文章封面、产品更新和社媒分发；视觉要有记忆点，但不喧宾夺主。避免可读文字、Logo、人物肖像、杂乱机房、过度抽象线条、廉价蓝图风和误导性金融暗示。";
export const DEFAULT_IMAGE_PROMPT_STYLE = DEFAULT_IMAGE_BLOCKCHAIN_PROMPT_STYLE;

function roleStyleSettingKey(roleId: AiWritingRoleId) {
  return `ai.openai.writing_role.${roleId}.style`;
}

type SettingRow = typeof appSettings.$inferSelect;

function decryptIfNeeded(row: SettingRow | undefined) {
  if (!row) return "";
  return row.encrypted ? decryptSettingValue(row.value) : row.value;
}

async function getSettings(keys: string[]) {
  return db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, keys));
}

function homepageSeoSettingKeys() {
  return [
    ...Object.values(HOMEPAGE_SEO_SETTING_KEYS.en),
    ...Object.values(HOMEPAGE_SEO_SETTING_KEYS.zh),
    HOMEPAGE_SEO_SETTING_KEYS.ogImage,
    HOMEPAGE_SEO_SETTING_KEYS.canonicalUrl,
    ...Object.values(LEGACY_HOMEPAGE_SEO_SETTING_KEYS)
  ];
}

function aiSettingKeys() {
  return [
    ...Object.values(AI_SETTING_KEYS),
    ...aiWritingRoles.map((role) => roleStyleSettingKey(role.id))
  ];
}

function imageGenerationSettingKeys() {
  return Object.values(IMAGE_GENERATION_SETTING_KEYS);
}

function imagePromptStyleFallback(byKey: Map<string, SettingRow>) {
  const value = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.promptStyle)
  ).trim();
  return value === LEGACY_IMAGE_PROMPT_STYLE ? "" : value;
}

function currentImagePromptStyle(
  value: string,
  legacyDefault: string,
  nextDefault: string
) {
  if (!value || value === legacyDefault || value === LEGACY_IMAGE_PROMPT_STYLE) {
    return nextDefault;
  }

  return value;
}

function imagePromptStyles(byKey: Map<string, SettingRow>) {
  const legacyPromptStyle = imagePromptStyleFallback(byKey);
  const blockchainPromptStyle = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.blockchainPromptStyle)
  ).trim();
  const aiPromptStyle = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.aiPromptStyle)
  ).trim();
  const infrastructurePromptStyle = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.infrastructurePromptStyle)
  ).trim();

  return {
    blockchain: currentImagePromptStyle(
      blockchainPromptStyle || legacyPromptStyle,
      LEGACY_IMAGE_BLOCKCHAIN_PROMPT_STYLE,
      DEFAULT_IMAGE_BLOCKCHAIN_PROMPT_STYLE
    ),
    ai: currentImagePromptStyle(
      aiPromptStyle || legacyPromptStyle,
      LEGACY_IMAGE_AI_PROMPT_STYLE,
      DEFAULT_IMAGE_AI_PROMPT_STYLE
    ),
    infrastructure: currentImagePromptStyle(
      infrastructurePromptStyle || legacyPromptStyle,
      LEGACY_IMAGE_INFRASTRUCTURE_PROMPT_STYLE,
      DEFAULT_IMAGE_INFRASTRUCTURE_PROMPT_STYLE
    )
  };
}

function settingOrigin(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return "";
  }
}

function canReuseApiKey(sourceBaseUrl: string, targetBaseUrl: string) {
  const sourceOrigin = settingOrigin(sourceBaseUrl);
  const targetOrigin = settingOrigin(targetBaseUrl);
  return Boolean(sourceOrigin && targetOrigin && sourceOrigin === targetOrigin);
}

export async function getAiSettingsForGeneration(roleId?: string) {
  const rows = await getSettings(aiSettingKeys());
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const apiKey = decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiKey)).trim();

  if (!apiKey) {
    throw new Error("AI API key is not configured.");
  }

  const model =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.model)).trim() || DEFAULT_AI_MODEL;
  const apiBaseUrl =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiBaseUrl)).trim() ||
    DEFAULT_AI_API_BASE_URL;
  const timeoutValue = Number(
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.timeoutMs)).trim()
  );
  const writingStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.writingStyle)).trim() ||
    DEFAULT_AI_WRITING_STYLE;
  const defaultWritingRole =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.defaultWritingRole)).trim() ||
    DEFAULT_AI_WRITING_ROLE_ID;
  const writingRole = getAiWritingRole(roleId || defaultWritingRole);
  const writingRoleStyle =
    decryptIfNeeded(byKey.get(roleStyleSettingKey(writingRole.id))).trim() ||
    writingRole.defaultStyle;
  const zhSeoStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.zhSeoStyle)).trim() ||
    DEFAULT_AI_ZH_SEO_STYLE;
  const enSeoStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.enSeoStyle)).trim() ||
    DEFAULT_AI_EN_SEO_STYLE;

  return {
    apiKey,
    apiBaseUrl,
    model,
    writingStyle,
    writingRole,
    writingRoleStyle,
    zhSeoStyle,
    enSeoStyle,
    timeoutMs:
      Number.isFinite(timeoutValue) && timeoutValue > 0
        ? timeoutValue
        : DEFAULT_AI_TIMEOUT_MS
  };
}

export async function getImageGenerationSettings() {
  const rows = await getSettings([
    ...Object.values(AI_SETTING_KEYS),
    ...imageGenerationSettingKeys()
  ]);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const imageApiKey = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.apiKey)
  ).trim();
  const fallbackApiKey = decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiKey)).trim();
  const apiBaseUrl =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.apiBaseUrl)).trim() ||
    DEFAULT_IMAGE_API_BASE_URL;
  const fallbackApiBaseUrl =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiBaseUrl)).trim() ||
    DEFAULT_AI_API_BASE_URL;
  const canReuseFallbackApiKey = canReuseApiKey(fallbackApiBaseUrl, apiBaseUrl);
  const apiKey = imageApiKey || (canReuseFallbackApiKey ? fallbackApiKey : "");

  if (!apiKey) {
    throw new Error(
      canReuseFallbackApiKey
        ? "Image generation API key is not configured."
        : "Image generation API key is not configured for this image provider. Configure a dedicated image API key because the text AI provider is different from the image provider."
    );
  }

  const timeoutValue = Number(
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.timeoutMs)).trim()
  );
  const presetValue = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.preset)
  ).trim();
  const preset = isImageGenerationPreset(presetValue)
    ? presetValue
    : DEFAULT_IMAGE_GENERATION_PRESET;

  return {
    apiKey,
    apiBaseUrl,
    model:
      decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.model)).trim() ||
      DEFAULT_IMAGE_MODEL,
    preset,
    size:
      decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.size)).trim() ||
      DEFAULT_IMAGE_SIZE,
    quality:
      decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.quality)).trim() ||
      DEFAULT_IMAGE_QUALITY,
    outputFormat:
      decryptIfNeeded(
        byKey.get(IMAGE_GENERATION_SETTING_KEYS.outputFormat)
      ).trim() || DEFAULT_IMAGE_OUTPUT_FORMAT,
    promptStyles: imagePromptStyles(byKey),
    timeoutMs:
      Number.isFinite(timeoutValue) && timeoutValue > 0
        ? timeoutValue
        : DEFAULT_IMAGE_TIMEOUT_MS
  };
}

export async function getSettingsPageData() {
  const rows = await getSettings([
    ...aiSettingKeys(),
    ...imageGenerationSettingKeys(),
    ...homepageSeoSettingKeys()
  ]);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const apiKey = decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiKey)).trim();
  const model =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.model)).trim() || DEFAULT_AI_MODEL;
  const apiBaseUrl =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiBaseUrl)).trim() ||
    DEFAULT_AI_API_BASE_URL;
  const timeoutValue =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.timeoutMs)).trim() ||
    String(DEFAULT_AI_TIMEOUT_MS);
  const writingStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.writingStyle)).trim() ||
    DEFAULT_AI_WRITING_STYLE;
  const defaultWritingRole =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.defaultWritingRole)).trim() ||
    DEFAULT_AI_WRITING_ROLE_ID;
  const zhSeoStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.zhSeoStyle)).trim() ||
    DEFAULT_AI_ZH_SEO_STYLE;
  const enSeoStyle =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.enSeoStyle)).trim() ||
    DEFAULT_AI_EN_SEO_STYLE;
  const writingRoles = aiWritingRoles.map((role) => ({
    ...role,
    style:
      decryptIfNeeded(byKey.get(roleStyleSettingKey(role.id))).trim() ||
      role.defaultStyle
  }));
  const imageApiKey = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.apiKey)
  ).trim();
  const imageApiBaseUrl =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.apiBaseUrl)).trim() ||
    DEFAULT_IMAGE_API_BASE_URL;
  const imageModel =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.model)).trim() ||
    DEFAULT_IMAGE_MODEL;
  const imagePresetValue = decryptIfNeeded(
    byKey.get(IMAGE_GENERATION_SETTING_KEYS.preset)
  ).trim();
  const imagePreset = isImageGenerationPreset(imagePresetValue)
    ? imagePresetValue
    : DEFAULT_IMAGE_GENERATION_PRESET;
  const imageSize =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.size)).trim() ||
    DEFAULT_IMAGE_SIZE;
  const imageQuality =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.quality)).trim() ||
    DEFAULT_IMAGE_QUALITY;
  const imageOutputFormat =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.outputFormat)).trim() ||
    DEFAULT_IMAGE_OUTPUT_FORMAT;
  const imageTimeoutValue =
    decryptIfNeeded(byKey.get(IMAGE_GENERATION_SETTING_KEYS.timeoutMs)).trim() ||
    String(DEFAULT_IMAGE_TIMEOUT_MS);
  const promptStyles = imagePromptStyles(byKey);
  const canReuseTextApiKey = canReuseApiKey(apiBaseUrl, imageApiBaseUrl);

  const homepageSeo = {
    enTitle: (
      decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.en.title)) ||
      decryptIfNeeded(byKey.get(LEGACY_HOMEPAGE_SEO_SETTING_KEYS.title))
    ).trim(),
    enDescription: (
      decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.en.description)) ||
      decryptIfNeeded(byKey.get(LEGACY_HOMEPAGE_SEO_SETTING_KEYS.description))
    ).trim(),
    enKeywords: (
      decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.en.keywords)) ||
      decryptIfNeeded(byKey.get(LEGACY_HOMEPAGE_SEO_SETTING_KEYS.keywords))
    ).trim(),
    enOgTitle: (
      decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.en.ogTitle)) ||
      decryptIfNeeded(byKey.get(LEGACY_HOMEPAGE_SEO_SETTING_KEYS.ogTitle))
    ).trim(),
    enOgDescription: (
      decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.en.ogDescription)) ||
      decryptIfNeeded(byKey.get(LEGACY_HOMEPAGE_SEO_SETTING_KEYS.ogDescription))
    ).trim(),
    zhTitle: decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.zh.title)).trim(),
    zhDescription: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.zh.description)
    ).trim(),
    zhKeywords: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.zh.keywords)
    ).trim(),
    zhOgTitle: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.zh.ogTitle)
    ).trim(),
    zhOgDescription: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.zh.ogDescription)
    ).trim(),
    ogImage: decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.ogImage)).trim(),
    canonicalUrl: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.canonicalUrl)
    ).trim()
  };

  return {
    ai: {
      hasApiKey: apiKey.length > 0,
      apiKeyPreview: apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "",
      apiBaseUrl,
      model,
      timeoutMs: timeoutValue,
      writingStyle,
      defaultWritingRole: isAiWritingRoleId(defaultWritingRole)
        ? defaultWritingRole
        : DEFAULT_AI_WRITING_ROLE_ID,
      writingRoles,
      zhSeoStyle,
      enSeoStyle
    },
    imageGeneration: {
      hasApiKey: imageApiKey.length > 0,
      canReuseTextApiKey,
      apiKeyPreview: imageApiKey
        ? `${imageApiKey.slice(0, 7)}...${imageApiKey.slice(-4)}`
        : "",
      apiBaseUrl: imageApiBaseUrl,
      model: imageModel,
      preset: imagePreset,
      size: imageSize,
      quality: imageQuality,
      outputFormat: imageOutputFormat,
      timeoutMs: imageTimeoutValue,
      promptStyles
    },
    homepageSeo
  };
}

export async function saveHomepageSeoSettings({
  enTitle,
  enDescription,
  enKeywords,
  enOgTitle,
  enOgDescription,
  zhTitle,
  zhDescription,
  zhKeywords,
  zhOgTitle,
  zhOgDescription,
  ogImage,
  canonicalUrl,
  userId
}: {
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
  userId: string;
}) {
  const now = new Date();
  const values = [
    { key: HOMEPAGE_SEO_SETTING_KEYS.en.title, value: enTitle?.trim() ?? "" },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.en.description,
      value: enDescription?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.en.keywords,
      value: enKeywords?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.en.ogTitle,
      value: enOgTitle?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.en.ogDescription,
      value: enOgDescription?.trim() ?? ""
    },
    { key: HOMEPAGE_SEO_SETTING_KEYS.zh.title, value: zhTitle?.trim() ?? "" },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.zh.description,
      value: zhDescription?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.zh.keywords,
      value: zhKeywords?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.zh.ogTitle,
      value: zhOgTitle?.trim() ?? ""
    },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.zh.ogDescription,
      value: zhOgDescription?.trim() ?? ""
    },
    { key: HOMEPAGE_SEO_SETTING_KEYS.ogImage, value: ogImage?.trim() ?? "" },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.canonicalUrl,
      value: canonicalUrl?.trim() ?? ""
    },
    { key: LEGACY_HOMEPAGE_SEO_SETTING_KEYS.title, value: enTitle?.trim() ?? "" },
    {
      key: LEGACY_HOMEPAGE_SEO_SETTING_KEYS.description,
      value: enDescription?.trim() ?? ""
    },
    {
      key: LEGACY_HOMEPAGE_SEO_SETTING_KEYS.keywords,
      value: enKeywords?.trim() ?? ""
    },
    {
      key: LEGACY_HOMEPAGE_SEO_SETTING_KEYS.ogTitle,
      value: enOgTitle?.trim() ?? ""
    },
    {
      key: LEGACY_HOMEPAGE_SEO_SETTING_KEYS.ogDescription,
      value: enOgDescription?.trim() ?? ""
    }
  ];

  await db.transaction(async (tx) => {
    for (const value of values) {
      await tx
        .insert(appSettings)
        .values({
          key: value.key,
          value: value.value,
          encrypted: false,
          updatedBy: userId,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: value.value,
            encrypted: false,
            updatedBy: userId,
            updatedAt: now
          }
        });
    }
  });
}

export async function saveAiSettings({
  apiKey,
  apiBaseUrl,
  model,
  timeoutMs,
  writingStyle,
  defaultWritingRole,
  writingRoleStyles,
  zhSeoStyle,
  enSeoStyle,
  userId
}: {
  apiKey?: string;
  apiBaseUrl?: string;
  model: string;
  timeoutMs: number;
  writingStyle?: string;
  defaultWritingRole?: string;
  writingRoleStyles?: Partial<Record<AiWritingRoleId, string>>;
  zhSeoStyle?: string;
  enSeoStyle?: string;
  userId: string;
}) {
  const now = new Date();

  const values: Array<{
    key: string;
    value: string;
    encrypted: boolean;
  }> = [
    {
      key: AI_SETTING_KEYS.apiBaseUrl,
      value: apiBaseUrl?.trim() || DEFAULT_AI_API_BASE_URL,
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.model,
      value: model,
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.timeoutMs,
      value: String(timeoutMs),
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.writingStyle,
      value: writingStyle?.trim() || DEFAULT_AI_WRITING_STYLE,
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.defaultWritingRole,
      value: getAiWritingRole(defaultWritingRole).id,
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.zhSeoStyle,
      value: zhSeoStyle?.trim() || DEFAULT_AI_ZH_SEO_STYLE,
      encrypted: false
    },
    {
      key: AI_SETTING_KEYS.enSeoStyle,
      value: enSeoStyle?.trim() || DEFAULT_AI_EN_SEO_STYLE,
      encrypted: false
    }
  ];

  for (const role of aiWritingRoles) {
    values.push({
      key: roleStyleSettingKey(role.id),
      value:
        writingRoleStyles?.[role.id]?.trim() ||
        role.defaultStyle,
      encrypted: false
    });
  }

  if (apiKey?.trim()) {
    values.push({
      key: AI_SETTING_KEYS.apiKey,
      value: encryptSettingValue(apiKey.trim()),
      encrypted: true
    });
  }

  await db.transaction(async (tx) => {
    for (const value of values) {
      await tx
        .insert(appSettings)
        .values({
          key: value.key,
          value: value.value,
          encrypted: value.encrypted,
          updatedBy: userId,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: value.value,
            encrypted: value.encrypted,
            updatedBy: userId,
            updatedAt: now
          }
        });
    }
  });
}

export async function saveImageGenerationSettings({
  apiKey,
  apiBaseUrl,
  model,
  preset,
  size,
  quality,
  outputFormat,
  timeoutMs,
  blockchainPromptStyle,
  aiPromptStyle,
  infrastructurePromptStyle,
  userId
}: {
  apiKey?: string;
  apiBaseUrl?: string;
  model: string;
  preset: string;
  size: string;
  quality: string;
  outputFormat: string;
  timeoutMs: number;
  blockchainPromptStyle?: string;
  aiPromptStyle?: string;
  infrastructurePromptStyle?: string;
  userId: string;
}) {
  const now = new Date();
  const values: Array<{
    key: string;
    value: string;
    encrypted: boolean;
  }> = [
    {
      key: IMAGE_GENERATION_SETTING_KEYS.apiBaseUrl,
      value: apiBaseUrl?.trim() || DEFAULT_IMAGE_API_BASE_URL,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.model,
      value: model.trim() || DEFAULT_IMAGE_MODEL,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.preset,
      value: isImageGenerationPreset(preset)
        ? preset
        : DEFAULT_IMAGE_GENERATION_PRESET,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.size,
      value: size || DEFAULT_IMAGE_SIZE,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.quality,
      value: quality || DEFAULT_IMAGE_QUALITY,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.outputFormat,
      value: outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.timeoutMs,
      value: String(timeoutMs),
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.blockchainPromptStyle,
      value: blockchainPromptStyle?.trim() || DEFAULT_IMAGE_BLOCKCHAIN_PROMPT_STYLE,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.aiPromptStyle,
      value: aiPromptStyle?.trim() || DEFAULT_IMAGE_AI_PROMPT_STYLE,
      encrypted: false
    },
    {
      key: IMAGE_GENERATION_SETTING_KEYS.infrastructurePromptStyle,
      value:
        infrastructurePromptStyle?.trim() ||
        DEFAULT_IMAGE_INFRASTRUCTURE_PROMPT_STYLE,
      encrypted: false
    }
  ];

  if (apiKey?.trim()) {
    values.push({
      key: IMAGE_GENERATION_SETTING_KEYS.apiKey,
      value: encryptSettingValue(apiKey.trim()),
      encrypted: true
    });
  }

  await db.transaction(async (tx) => {
    for (const value of values) {
      await tx
        .insert(appSettings)
        .values({
          key: value.key,
          value: value.value,
          encrypted: value.encrypted,
          updatedBy: userId,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: value.value,
            encrypted: value.encrypted,
            updatedBy: userId,
            updatedAt: now
          }
        });
    }
  });
}
