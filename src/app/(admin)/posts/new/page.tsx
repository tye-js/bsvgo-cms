import { Sparkles } from "lucide-react";

import { DetailDrawer, InfoList } from "@/components/admin/DataLayout";
import { PageHeader } from "@/components/admin/PageHeader";
import { PostForm } from "@/components/forms/PostForm";
import { createPostAction } from "@/server/content/actions";
import { getPostEditorOptions } from "@/server/content/queries";
import { getSettingsPageData } from "@/server/settings/service";

export default async function NewPostPage() {
  const [options, settings] = await Promise.all([
    getPostEditorOptions(),
    getSettingsPageData()
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="AI 改写"
        description="只保留素材区和 AI 生成入口，提交后后台生成中英文草稿、SEO 和封面任务。"
        icon={<Sparkles size={20} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PostForm
          action={createPostAction}
          categories={options.categories}
          tags={options.tags}
          mediaAssets={[]}
          submitLabel="创建文章"
          writingRoles={settings.ai.writingRoles}
          defaultWritingRole={settings.ai.defaultWritingRole}
          generateEnglishFromChinese
          aiOnlyCreate
        />
        <DetailDrawer
          title="生成流程"
          description="生成按钮位于表单右上，任务进入后台后可以继续录入下一篇。"
        >
          <InfoList
            items={[
              { label: "默认角色", value: settings.ai.defaultWritingRole },
              { label: "文本模型", value: settings.ai.model },
              {
                label: "步骤",
                value: "素材读取 -> 中文稿 -> 英文稿 -> SEO -> 草稿 -> 封面任务"
              },
              {
                label: "进度",
                value: "可在 AI 任务中心查看、重试和继续生成"
              }
            ]}
          />
        </DetailDrawer>
      </div>
    </div>
  );
}
