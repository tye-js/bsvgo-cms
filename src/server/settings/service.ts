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
  title: "seo.home.title",
  description: "seo.home.description",
  keywords: "seo.home.keywords",
  ogTitle: "seo.home.og_title",
  ogDescription: "seo.home.og_description",
  ogImage: "seo.home.og_image",
  canonicalUrl: "seo.home.canonical_url"
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
    ...Object.values(HOMEPAGE_SEO_SETTING_KEYS)
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
    title: decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.title)).trim(),
    description: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.description)
    ).trim(),
    keywords: decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.keywords)).trim(),
    ogTitle: decryptIfNeeded(byKey.get(HOMEPAGE_SEO_SETTING_KEYS.ogTitle)).trim(),
    ogDescription: decryptIfNeeded(
      byKey.get(HOMEPAGE_SEO_SETTING_KEYS.ogDescription)
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
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  canonicalUrl,
  userId
}: {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  userId: string;
}) {
  const now = new Date();
  const values = [
    { key: HOMEPAGE_SEO_SETTING_KEYS.title, value: title.trim() },
    { key: HOMEPAGE_SEO_SETTING_KEYS.description, value: description.trim() },
    { key: HOMEPAGE_SEO_SETTING_KEYS.keywords, value: keywords?.trim() ?? "" },
    { key: HOMEPAGE_SEO_SETTING_KEYS.ogTitle, value: ogTitle?.trim() ?? "" },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.ogDescription,
      value: ogDescription?.trim() ?? ""
    },
    { key: HOMEPAGE_SEO_SETTING_KEYS.ogImage, value: ogImage?.trim() ?? "" },
    {
      key: HOMEPAGE_SEO_SETTING_KEYS.canonicalUrl,
      value: canonicalUrl?.trim() ?? ""
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
