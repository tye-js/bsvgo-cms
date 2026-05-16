import "server-only";

import { inArray } from "drizzle-orm";

import { decryptSettingValue, encryptSettingValue } from "@/server/settings/crypto";
import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";

export const AI_SETTING_KEYS = {
  apiKey: "ai.openai.api_key",
  model: "ai.openai.model",
  timeoutMs: "ai.openai.timeout_ms"
} as const;

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
    throw new Error("AI OpenAI API key is not configured.");
  }

  const model =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.model)).trim() || DEFAULT_AI_MODEL;
  const timeoutValue = Number(
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.timeoutMs)).trim()
  );

  return {
    apiKey,
    model,
    timeoutMs:
      Number.isFinite(timeoutValue) && timeoutValue > 0
        ? timeoutValue
        : DEFAULT_AI_TIMEOUT_MS
  };
}

export async function getSettingsPageData() {
  const rows = await getSettings(Object.values(AI_SETTING_KEYS));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const apiKey = decryptIfNeeded(byKey.get(AI_SETTING_KEYS.apiKey)).trim();
  const model =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.model)).trim() || DEFAULT_AI_MODEL;
  const timeoutValue =
    decryptIfNeeded(byKey.get(AI_SETTING_KEYS.timeoutMs)).trim() ||
    String(DEFAULT_AI_TIMEOUT_MS);

  return {
    ai: {
      hasApiKey: apiKey.length > 0,
      apiKeyPreview: apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "",
      model,
      timeoutMs: timeoutValue
    }
  };
}

export async function saveAiSettings({
  apiKey,
  model,
  timeoutMs,
  userId
}: {
  apiKey?: string;
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
