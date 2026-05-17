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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">新建文章</h1>
        <p className="mt-1 text-sm text-slate-500">
          从中文草稿创建文章，英文版本会由已配置的 AI 自动生成。
        </p>
      </div>
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
