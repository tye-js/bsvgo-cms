import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName } from "@/components/admin/Button";
import { DetailDrawer, InfoList } from "@/components/admin/DataLayout";
import { PageHeader } from "@/components/admin/PageHeader";
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
      <PageHeader
        eyebrow="专题辑"
        title={collection.title}
        description={collection.zhDescription || collection.enDescription || collection.slug}
        actions={
          <>
            <Link href="/collections" className={buttonClassName("secondary")}>
              返回专题辑
            </Link>
            <Link href="/posts" className={buttonClassName("secondary")}>
              查看文章列表
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
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

        <DetailDrawer
          title="专题预览"
          description="右侧保持专题状态、添加文章和当前顺序摘要，排序表专注操作。"
        >
          <InfoList
            items={[
              {
                label: "状态",
                value: <Badge tone={collection.status}>{postStatusLabel(collection.status)}</Badge>
              },
              { label: "Slug", value: collection.slug },
              { label: "文章数", value: collection.posts.length },
              { label: "更新时间", value: formatDate(collection.updatedAt) }
            ]}
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-950">添加文章</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              默认追加到专题末尾，填写排序值可插入指定位置。
            </p>
            <div className="mt-3">
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
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">当前前 5 篇</h3>
            <ol className="mt-3 grid gap-2 text-sm text-slate-600">
              {collection.posts.slice(0, 5).map((post, index) => (
                <li key={post.postId} className="flex gap-2">
                  <span className="text-slate-400">{index + 1}.</span>
                  <span className="line-clamp-2">{post.title}</span>
                </li>
              ))}
              {collection.posts.length === 0 ? (
                <li className="text-slate-500">暂无文章。</li>
              ) : null}
            </ol>
          </div>
        </DetailDrawer>
      </div>
    </div>
  );
}
