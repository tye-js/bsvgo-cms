import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
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
            排序值越小越靠前。建议使用 1000 间隔，方便在两篇文章中间插入新文章。
          </p>
        </div>

        <TopicCollectionSortForm
          collectionId={collection.id}
          posts={collection.posts}
          action={updateTopicCollectionSortAction}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[320px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[180px]" />
                <col className="w-[180px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">排序</th>
                  <th className="px-5 py-3 font-medium">文章</th>
                  <th className="px-5 py-3 font-medium">分类</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">创建时间</th>
                  <th className="px-5 py-3 font-medium">更新时间</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collection.posts.map((post, index) => {
                  const removeFormId = `remove-topic-post-${post.postId}`;

                  return (
                    <tr key={post.postId} className="align-top">
                      <td className="px-5 py-4">
                        <input type="hidden" name="postId" value={post.postId} />
                        <input
                          name="sortOrder"
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          defaultValue={post.sortOrder}
                          className={`${inputClassName} w-28`}
                          aria-label={`第 ${index + 1} 篇文章排序`}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/posts/${post.postId}/edit`}
                          className="font-medium text-slate-950 hover:text-slate-700 hover:underline"
                        >
                          {post.title}
                        </Link>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {post.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {post.categoryName}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={post.status}>
                          {postStatusLabel(post.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(post.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(post.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <ConfirmSubmitButton
                          form={removeFormId}
                          message="确定从专题中移除这篇文章吗？文章本身不会被删除。"
                          className="min-h-8 px-2"
                        >
                          移除
                        </ConfirmSubmitButton>
                      </td>
                    </tr>
                  );
                })}
                {collection.posts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      这个专题还没有文章。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </TopicCollectionSortForm>

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
