"use server";

import { revalidatePath } from "next/cache";

import { aiSettingsSchema } from "@/lib/validators";
import { requireRole } from "@/server/auth/session";
import { saveAiSettings } from "@/server/settings/service";

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
    return { error: parsed.error.issues[0]?.message ?? "Invalid AI settings" };
  }

  await saveAiSettings({
    apiKey: parsed.data.apiKey,
    apiBaseUrl: parsed.data.apiBaseUrl,
    model: parsed.data.model,
    timeoutMs: parsed.data.timeoutMs,
    userId: user.id
  });

  revalidatePath("/settings");
  return { success: "AI settings saved." };
}
