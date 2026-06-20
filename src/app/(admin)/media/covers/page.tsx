import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";

import { BulkCoverImageGenerationForm } from "@/components/forms/BulkCoverImageGenerationForm";
import { buttonClassName } from "@/components/admin/Button";
import { requireContentEditor } from "@/server/auth/session";
import { bulkGeneratePostCoverImagesAction } from "@/server/media/actions";
import { getPostCoverGenerationOptions } from "@/server/media/service";

export default async function MediaCoverGenerationPage() {
  await requireContentEditor();
  const coverPostOptions = await getPostCoverGenerationOptions(100);
  const withoutCoverCount = coverPostOptions.filter((post) => !post.coverImage).length;
  const withCoverCount = coverPostOptions.length - withoutCoverCount;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/media"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            返回媒体库
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            文章封面生成
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            按文章标题、描述和大分类批量生成封面，并自动写入媒体库和文章封面字段。
          </p>
        </div>
        <Link href="/media/new" className={buttonClassName("secondary", "shrink-0")}>
          <ImagePlus size={17} />
          手动新建图片
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">可选文章</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {coverPostOptions.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">无封面</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {withoutCoverCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">已有封面</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {withCoverCount}
          </p>
        </div>
      </section>

      <BulkCoverImageGenerationForm
        action={bulkGeneratePostCoverImagesAction}
        posts={coverPostOptions}
        defaultExpanded
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-950">封面生成进度</h2>
            <p className="mt-1 text-sm text-slate-500">
              所有封面任务进度、错误和重试都已合并到 AI 任务中心。
            </p>
          </div>
          <Link
            href="/ai/jobs?type=bulk_post_cover_images"
            className={buttonClassName("secondary", "shrink-0")}
          >
            查看封面任务
          </Link>
        </div>
      </section>
    </div>
  );
}
