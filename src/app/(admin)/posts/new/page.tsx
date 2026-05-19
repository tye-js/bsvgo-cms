import { PostForm } from "@/components/forms/PostForm";
import { createPostAction } from "@/server/content/actions";
import { getPostEditorOptions } from "@/server/content/queries";
import { getMediaAssetOptions } from "@/server/media/service";

export default async function NewPostPage() {
  const [options, mediaAssets] = await Promise.all([
    getPostEditorOptions(),
    getMediaAssetOptions()
  ]);

  return (
    <div className="grid gap-6">
      <PostForm
        action={createPostAction}
        categories={options.categories}
        tags={options.tags}
        mediaAssets={mediaAssets}
        submitLabel="创建文章"
        generateEnglishFromChinese
      />
    </div>
  );
}
