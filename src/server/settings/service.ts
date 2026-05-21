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

export const DEFAULT_AI_API_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_MODEL = "gpt-5.3-codex";
export const DEFAULT_AI_TIMEOUT_MS = 60000;
export const DEFAULT_AI_WRITING_STYLE =
  "面向 BSVgo 技术读者，语言清晰、克制、可信。优先使用结构化小标题、短段落和 Markdown 正文，不输出 HTML。所有事实、数据、人物、时间、链接、代码、产品能力和因果判断必须来自素材或明确标注为推断；素材不足时要保守表达，不编造细节。允许适度营销，但必须具体、可验证、不过度承诺。中文正文自然专业，英文正文面向全球技术读者，避免中式直译。Slug 使用小写英文、数字和连字符，简短表达核心主题。SEO 要分别服务中文入口和英文入口，提炼真实关键词，不堆砌。";

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

export async function getSettingsPageData() {
  const rows = await getSettings([
    ...aiSettingKeys(),
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
