import { Bot, Database, Image, Search, ShieldCheck } from "lucide-react";

import { AiSettingsForm } from "@/components/forms/AiSettingsForm";
import { HomepageSeoForm } from "@/components/forms/HomepageSeoForm";
import {
  generateHomepageSeoAction,
  updateAiSettingsAction,
  updateHomepageSeoAction
} from "@/server/settings/actions";
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Search size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">首页 SEO</h2>
            <p className="mt-1 text-sm text-slate-500">
              管理首页标题、描述、关键词、Open Graph 和 canonical URL，可用 AI 生成优化建议。
            </p>
          </div>
        </div>
        <HomepageSeoForm
          action={updateHomepageSeoAction}
          generateAction={generateHomepageSeoAction}
          value={settings.homepageSeo}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">SEO 管理范围</h2>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
          <p>
            首页 SEO 在本页维护，保存到数据库设置项，供前台首页读取。
          </p>
          <p>
            分类页 SEO 在「分类」编辑页维护，包括 SEO 标题和描述。
          </p>
          <p>
            标签页 SEO 在「标签」编辑页维护，包括 SEO 标题和描述。
          </p>
          <p>
            文章页 SEO 在「文章」编辑页维护，跟随同一篇文章的英文主内容记录保存。
          </p>
        </div>
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
