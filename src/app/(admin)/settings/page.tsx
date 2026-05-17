import { Bot, Database, Image, ShieldCheck } from "lucide-react";

import { AiSettingsForm } from "@/components/forms/AiSettingsForm";
import { updateAiSettingsAction } from "@/server/settings/actions";
import { getSettingsPageData } from "@/server/settings/service";

export default async function SettingsPage() {
  const settings = await getSettingsPageData();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理 AI 生成、数据库访问和媒体策略等运行配置。
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">AI 英文生成</h2>
            <p className="mt-1 text-sm text-slate-500">
              用于从中文草稿创建文章时生成英文内容。仅管理员可以修改此配置。
            </p>
          </div>
        </div>
        <AiSettingsForm
          action={updateAiSettingsAction}
          hasApiKey={settings.ai.hasApiKey}
          apiKeyPreview={settings.ai.apiKeyPreview}
          apiBaseUrl={settings.ai.apiBaseUrl}
          model={settings.ai.model}
          timeoutMs={settings.ai.timeoutMs}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Database className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">数据库</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            内容通过 Drizzle schema 和迁移存储在 PostgreSQL 中。
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">认证</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            会话存储在数据库中，密码哈希使用 Argon2id。
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Image className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">媒体</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            封面图片以受管理的 URL 资源保存，可结合本地存储或对象存储策略使用。
          </p>
        </div>
      </section>
    </div>
  );
}
