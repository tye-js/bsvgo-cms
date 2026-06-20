import { Bot, Database, Image as ImageIcon, Search, ShieldCheck } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { DetailDrawer, InfoList } from "@/components/admin/DataLayout";
import { PageHeader } from "@/components/admin/PageHeader";
import { AiSettingsForm } from "@/components/forms/AiSettingsForm";
import { HomepageSeoForm } from "@/components/forms/HomepageSeoForm";
import {
  generateHomepageSeoSuggestionAction,
  saveHomepageSeoSettingsAction,
  testAiProviderSettingsAction,
  testImageGenerationSettingsAction,
  updateAiJobSettingsAction,
  updateAiProviderSettingsAction,
  updateAiSeoStyleSettingsAction,
  updateAiWritingSettingsAction,
  updateImageGenerationSettingsAction,
} from "@/server/settings/actions";
import { requireContentEditor } from "@/server/auth/session";
import { getSettingsPageData } from "@/server/settings/service";

export default async function SettingsPage() {
  const user = await requireContentEditor();
  const settings = await getSettingsPageData();
  const canManageAiSettings = user.role === "admin";

  return (
    <div className="grid gap-6">
      <PageHeader
        title="系统设置"
        description="集中维护 AI 文本模型、图片模型、写作策略、SEO、首页元信息和审计入口。"
        icon={<Bot size={20} />}
        actions={
          <a href="/settings/audit" className={buttonClassName("secondary")}>
            设置审计
          </a>
        }
      />

      {canManageAiSettings ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-950">AI 内容与 SEO 生成</h2>
                <p className="mt-1 text-sm text-slate-500">
                  用于从中文草稿创建英文内容，也用于生成中英文 SEO 建议。仅管理员可以修改此配置。
                </p>
              </div>
            </div>
            <AiSettingsForm
              providerAction={updateAiProviderSettingsAction}
              providerTestAction={testAiProviderSettingsAction}
              writingAction={updateAiWritingSettingsAction}
              seoStyleAction={updateAiSeoStyleSettingsAction}
              imageGenerationAction={updateImageGenerationSettingsAction}
              imageGenerationTestAction={testImageGenerationSettingsAction}
              jobSettingsAction={updateAiJobSettingsAction}
              hasApiKey={settings.ai.hasApiKey}
              apiKeyPreview={settings.ai.apiKeyPreview}
              apiBaseUrl={settings.ai.apiBaseUrl}
              model={settings.ai.model}
              timeoutMs={settings.ai.timeoutMs}
              writingStyle={settings.ai.writingStyle}
              defaultWritingRole={settings.ai.defaultWritingRole}
              writingRoles={settings.ai.writingRoles}
              zhSeoStyle={settings.ai.zhSeoStyle}
              enSeoStyle={settings.ai.enSeoStyle}
              imageGeneration={settings.imageGeneration}
              aiJobs={settings.aiJobs}
            />
          </div>
          <DetailDrawer
            title="配置诊断"
            description="保存前可直接测试当前表单值，失败时查看真实响应。"
            actions={
              <a href="/settings/audit" className={buttonClassName("secondary", "min-h-9")}>
                查看审计
              </a>
            }
          >
            <InfoList
              items={[
                {
                  label: "文本模型",
                  value: `${settings.ai.model} · ${settings.ai.apiBaseUrl}`
                },
                {
                  label: "文本 Key",
                  value: settings.ai.hasApiKey
                    ? `已配置（${settings.ai.apiKeyPreview}）`
                    : "未配置"
                },
                {
                  label: "图片模型",
                  value: `${settings.imageGeneration.model} · ${settings.imageGeneration.apiBaseUrl}`
                },
                {
                  label: "图片 Key",
                  value: settings.imageGeneration.hasApiKey
                    ? `已配置（${settings.imageGeneration.apiKeyPreview}）`
                    : settings.imageGeneration.canReuseTextApiKey
                      ? "复用文本 Key"
                      : "未配置"
                }
              ]}
            />
          </DetailDrawer>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Search size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">双语首页 SEO</h2>
            <p className="mt-1 text-sm text-slate-500">
              分别管理英文首页和中文首页的标题、描述、关键词与 Open Graph 文案，可用 AI 同时生成双语建议。
            </p>
          </div>
        </div>
        <HomepageSeoForm
          saveAction={saveHomepageSeoSettingsAction}
          generateAction={generateHomepageSeoSuggestionAction}
          value={settings.homepageSeo}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">SEO 管理范围</h2>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
          <p>
            首页 SEO 在本页维护，按 `seo.home.en.*` 和 `seo.home.zh.*` 保存，供前台中英文首页读取。
          </p>
          <p>
            分类页 SEO 在「分类」编辑页维护，英文和中文分别保存到分类翻译记录。
          </p>
          <p>
            标签页 SEO 在「标签」编辑页维护，英文和中文分别保存到标签翻译记录。
          </p>
          <p>
            文章页 SEO 在「文章」编辑页维护，英文 SEO 对应英文文章翻译，中文 SEO 对应中文文章翻译。
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
          <ImageIcon className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">媒体</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            封面图片以受管理的 URL 资源保存，可结合本地存储或对象存储策略使用。
          </p>
        </div>
      </section>
    </div>
  );
}
