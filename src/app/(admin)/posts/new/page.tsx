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
    </div>
  );
}
