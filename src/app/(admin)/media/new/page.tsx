import { MediaAssetForm } from "@/components/forms/MediaAssetForm";
import { createMediaAssetAction } from "@/server/media/actions";

export default function NewMediaPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">New image</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a local image or register an external URL for post cover selection.
        </p>
      </div>
      <MediaAssetForm action={createMediaAssetAction} />
    </div>
  );
}
