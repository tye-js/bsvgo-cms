import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName } from "@/components/admin/Button";
import {
  AddTopicCollectionPostForm,
  TopicCollectionSortForm
} from "@/components/forms/TopicCollectionManageForms";
import { formatDate, postStatusLabel } from "@/lib/utils";
import {
  addTopicCollectionPostAction,
  removeTopicCollectionPostAction,
  updateTopicCollectionSortAction
} from "@/server/content/actions";
import {
  getTopicCollectionForManage,
  listTopicCollectionPostCandidates
} from "@/server/content/queries";

export default async function TopicCollectionManagePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collection, candidates] = await Promise.all([
    getTopicCollectionForManage(id),
    listTopicCollectionPostCandidates(id)
  ]);

  if (!collection) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/collections"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            返回专题辑
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {collection.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {collection.zhDescription || collection.enDescription || collection.slug}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone={collection.status}>{postStatusLabel(collection.status)}</Badge>
            <span>slug: {collection.slug}</span>
            <span>专题文章：{collection.posts.length}</span>
            <span>更新：{formatDate(collection.updatedAt)}</span>
          </div>
        </div>
        <Link href="/posts" className={buttonClassName("secondary", "shrink-0")}>
          查看文章列表
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">添加文章</h2>
        <p className="mt-1 text-sm text-slate-500">
          默认会追加到专题末尾。手动填写排序值可以插入到指定位置。
        </p>
        <div className="mt-4">
          <AddTopicCollectionPostForm
            collectionId={collection.id}
            candidates={candidates.map((post) => ({
              id: post.id,
              title: post.title,
              slug: post.slug,
              categoryName: post.categoryName
            }))}
            action={addTopicCollectionPostAction}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">专题文章排序</h2>
          <p className="mt-1 text-sm text-slate-500">
            支持拖拽手动排序、按创建/发布时间规则排序，以及批量重编号。
          </p>
        </div>

        <TopicCollectionSortForm
          collectionId={collection.id}
          posts={collection.posts}
          action={updateTopicCollectionSortAction}
          removeFormId={(postId) => `remove-topic-post-${postId}`}
        />

        {collection.posts.map((post) => (
          <form
            key={`remove-form-${post.postId}`}
            id={`remove-topic-post-${post.postId}`}
            action={removeTopicCollectionPostAction}
          >
            <input type="hidden" name="collectionId" value={collection.id} />
            <input type="hidden" name="postId" value={post.postId} />
          </form>
        ))}
      </section>
    </div>
  );
}
