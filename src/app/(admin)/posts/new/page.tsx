import { PostForm } from "@/components/forms/PostForm";
import { createPostAction } from "@/server/content/actions";
import { getPostEditorOptions } from "@/server/content/queries";
import { getMediaAssetOptions } from "@/server/media/service";
import { getSettingsPageData } from "@/server/settings/service";

export default async function NewPostPage() {
  const [options, mediaAssets, settings] = await Promise.all([
    getPostEditorOptions(),
    getMediaAssetOptions(),
    getSettingsPageData()
  ]);

  return (
    <div className="grid gap-6">
      <PostForm
        action={createPostAction}
        categories={options.categories}
        tags={options.tags}
        mediaAssets={mediaAssets}
        submitLabel="创建文章"
        writingRoles={settings.ai.writingRoles}
        defaultWritingRole={settings.ai.defaultWritingRole}
        generateEnglishFromChinese
      />
    </div>
  );
}
