import "server-only";

import { inArray } from "drizzle-orm";

import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";
import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";

export const AI_SETTING_KEYS = {
  apiKey: "ai.openai.api_key",
  apiBaseUrl: "ai.openai.api_base_url",
  model: "ai.openai.model",
  timeoutMs: "ai.openai.timeout_ms"
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

export async function getAiSettingsForGeneration() {
  const rows = await getSettings(Object.values(AI_SETTING_KEYS));
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

  return {
    apiKey,
    apiBaseUrl,
    model,
    timeoutMs:
      Number.isFinite(timeoutValue) && timeoutValue > 0
        ? timeoutValue
        : DEFAULT_AI_TIMEOUT_MS
  };
}

export async function getSettingsPageData() {
  const rows = await getSettings([
    ...Object.values(AI_SETTING_KEYS),
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
      timeoutMs: timeoutValue
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
  userId
}: {
  apiKey?: string;
  apiBaseUrl?: string;
  model: string;
  timeoutMs: number;
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
    }
  ];

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
