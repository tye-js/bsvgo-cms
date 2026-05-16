"use client";

import { useActionState } from "react";

import { Field, inputClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
  success?: string;
};

export function AiSettingsForm({
  action,
  hasApiKey,
  apiKeyPreview,
  apiBaseUrl,
  model,
  timeoutMs
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  hasApiKey: boolean;
  apiKeyPreview: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-5">
      {state.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        API key status:{" "}
        <span className="font-medium text-slate-900">
          {hasApiKey ? `Configured (${apiKeyPreview})` : "Not configured"}
        </span>
      </div>

      <Field
        label="API key"
        hint="Leave blank to keep the existing key. The full key is encrypted server-side and never displayed."
      >
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          className={inputClassName}
          placeholder={hasApiKey ? "Keep existing key" : "sk-..."}
        />
      </Field>

      <Field
        label="API base URL"
        hint="Use an OpenAI-compatible /v1 endpoint. Leave the default for the official OpenAI API."
      >
        <input
          name="apiBaseUrl"
          type="url"
          defaultValue={apiBaseUrl}
          className={inputClassName}
          placeholder="https://api.openai.com/v1"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="Model">
          <input
            name="model"
            defaultValue={model}
            required
            className={inputClassName}
          />
        </Field>
        <Field label="Timeout ms">
          <input
            name="timeoutMs"
            type="number"
            min={5000}
            max={180000}
            step={1000}
            defaultValue={timeoutMs}
            required
            className={inputClassName}
          />
        </Field>
      </div>

      <div>
        <SubmitButton>Save AI settings</SubmitButton>
      </div>
    </form>
  );
}
