import { MediaAssetForm } from "@/components/forms/MediaAssetForm";
import { createMediaAssetAction } from "@/server/media/actions";

export default function NewMediaPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">新建图片</h1>
        <p className="mt-1 text-sm text-slate-500">
          上传本地图片，或登记一个可用于文章封面的外部图片 URL。
        </p>
      </div>
      <MediaAssetForm action={createMediaAssetAction} />
    </div>
  );
}
