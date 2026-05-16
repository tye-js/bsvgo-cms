import { Bot, Database, Image, ShieldCheck } from "lucide-react";

import { AiSettingsForm } from "@/components/forms/AiSettingsForm";
import { updateAiSettingsAction } from "@/server/settings/actions";
import { getSettingsPageData } from "@/server/settings/service";

export default async function SettingsPage() {
  const settings = await getSettingsPageData();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Operational configuration for AI generation, database access, and media policy.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">AI English generation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Used when creating a post from a Chinese source draft. Only admins can change this configuration.
            </p>
          </div>
        </div>
        <AiSettingsForm
          action={updateAiSettingsAction}
          hasApiKey={settings.ai.hasApiKey}
          apiKeyPreview={settings.ai.apiKeyPreview}
          model={settings.ai.model}
          timeoutMs={settings.ai.timeoutMs}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Database className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Database</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Content is stored in PostgreSQL through Drizzle schema and migrations.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Authentication</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sessions are database-backed and password hashes use Argon2id.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Image className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Media</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Cover images are stored as managed URL assets. Upload can be added later with local storage or object storage policies.
          </p>
        </div>
      </section>
    </div>
  );
}
