"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/admin/Badge";
import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { cn, formatDate, postStatusLabel } from "@/lib/utils";
import type { PostStatus } from "@/server/db/schema";

type ActionState = {
  error?: string;
  success?: string;
};

type CandidatePost = {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
};

type CollectionPost = {
  postId: string;
  title: string;
  slug: string;
  categoryName: string;
  status: PostStatus;
  sortOrder: number;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  publishedAt: Date | string | null;
};

type SortMode =
  | "created_asc"
  | "created_desc"
  | "published_asc"
  | "published_desc";

export function AddTopicCollectionPostForm({
  collectionId,
  candidates,
  action
}: {
  collectionId: string;
  candidates: CandidatePost[];
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="collectionId" value={collectionId} />
      <PendingFieldset className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
        <select
          name="postId"
          required
          className={inputClassName}
          disabled={candidates.length === 0}
          defaultValue=""
        >
          <option value="" disabled>
            {candidates.length ? "选择要加入专题的文章" : "没有可添加的文章"}
          </option>
          {candidates.map((post) => (
            <option key={post.id} value={post.id}>
              {post.title} · {post.categoryName} · {post.slug}
            </option>
          ))}
        </select>
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={1000000}
          step={1}
          className={inputClassName}
          placeholder="留空追加"
        />
        <SubmitButton disabled={candidates.length === 0}>添加文章</SubmitButton>
      </PendingFieldset>
      {state.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function TopicCollectionSortForm({
  collectionId,
  posts,
  action,
  removeFormId
}: {
  collectionId: string;
  posts: CollectionPost[];
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  removeFormId: (postId: string) => string;
}) {
  const [state, formAction] = useActionState(action, {});
  const initialRows = useMemo(
    () => posts.map((post) => ({ ...post, sortOrder: Number(post.sortOrder ?? 0) })),
    [posts]
  );
  const [rows, setRows] = useState(initialRows);
  const [draggedPostId, setDraggedPostId] = useState("");

  function renumber(nextRows = rows) {
    return nextRows.map((post, index) => ({
      ...post,
      sortOrder: (index + 1) * 1000
    }));
  }

  function timeValue(value: Date | string | null | undefined) {
    if (!value) return 0;
    const date = typeof value === "string" ? new Date(value) : value;
    const timestamp = date.getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function applyRuleSort(mode: SortMode) {
    const sorted = [...rows].sort((left, right) => {
      const leftPublished = timeValue(left.publishedAt) || timeValue(left.createdAt);
      const rightPublished = timeValue(right.publishedAt) || timeValue(right.createdAt);
      const leftCreated = timeValue(left.createdAt);
      const rightCreated = timeValue(right.createdAt);

      if (mode === "created_asc") return leftCreated - rightCreated;
      if (mode === "created_desc") return rightCreated - leftCreated;
      if (mode === "published_asc") return leftPublished - rightPublished;
      return rightPublished - leftPublished;
    });

    setRows(renumber(sorted));
  }

  function moveRow(targetPostId: string) {
    if (!draggedPostId || draggedPostId === targetPostId) return;

    setRows((current) => {
      const draggedIndex = current.findIndex((post) => post.postId === draggedPostId);
      const targetIndex = current.findIndex((post) => post.postId === targetPostId);
      if (draggedIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return renumber(next);
    });
    setDraggedPostId("");
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="collectionId" value={collectionId} />
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
        <button
          type="button"
          onClick={() => applyRuleSort("created_asc")}
          className={buttonClassName("secondary", "min-h-8 px-2")}
        >
          创建时间正序
        </button>
        <button
          type="button"
          onClick={() => applyRuleSort("created_desc")}
          className={buttonClassName("secondary", "min-h-8 px-2")}
        >
          创建时间倒序
        </button>
        <button
          type="button"
          onClick={() => applyRuleSort("published_asc")}
          className={buttonClassName("secondary", "min-h-8 px-2")}
        >
          发布时间正序
        </button>
        <button
          type="button"
          onClick={() => applyRuleSort("published_desc")}
          className={buttonClassName("secondary", "min-h-8 px-2")}
        >
          发布时间倒序
        </button>
        <button
          type="button"
          onClick={() => setRows((current) => renumber(current))}
          className={buttonClassName("secondary", "min-h-8 px-2")}
        >
          批量重编号
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[64px]" />
            <col className="w-[120px]" />
            <col className="w-[320px]" />
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col className="w-[170px]" />
            <col className="w-[170px]" />
            <col className="w-[170px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">拖拽</th>
              <th className="px-4 py-3 font-medium">排序</th>
              <th className="px-4 py-3 font-medium">文章</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">发布时间</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((post, index) => (
              <tr
                key={post.postId}
                draggable
                onDragStart={() => setDraggedPostId(post.postId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveRow(post.postId)}
                onDragEnd={() => setDraggedPostId("")}
                className={cn(
                  "align-top",
                  draggedPostId === post.postId ? "bg-slate-50 opacity-60" : ""
                )}
              >
                <td className="px-4 py-4">
                  <span
                    className="inline-flex cursor-grab rounded border border-slate-200 bg-white p-1 text-slate-400"
                    title="拖拽调整排序"
                  >
                    <GripVertical size={16} />
                  </span>
                </td>
                <td className="px-4 py-4">
                  <input type="hidden" name="postId" value={post.postId} />
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    value={post.sortOrder}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setRows((current) =>
                        current.map((item) =>
                          item.postId === post.postId
                            ? {
                                ...item,
                                sortOrder: Number.isFinite(nextValue)
                                  ? nextValue
                                  : 0
                              }
                            : item
                        )
                      );
                    }}
                    className={`${inputClassName} w-28`}
                    aria-label={`第 ${index + 1} 篇文章排序`}
                  />
                </td>
                <td className="px-4 py-4">
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
                <td className="px-4 py-4 text-slate-600">
                  {post.categoryName}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={post.status}>{postStatusLabel(post.status)}</Badge>
                </td>
                <td className="px-4 py-4 text-slate-500">
                  {formatDate(post.createdAt)}
                </td>
                <td className="px-4 py-4 text-slate-500">
                  {formatDate(post.publishedAt)}
                </td>
                <td className="px-4 py-4 text-slate-500">
                  {formatDate(post.updatedAt)}
                </td>
                <td className="px-4 py-4">
                  <ConfirmSubmitButton
                    form={removeFormId(post.postId)}
                    message="确定从专题中移除这篇文章吗？文章本身不会被删除。"
                    className="min-h-8 px-2"
                  >
                    移除
                  </ConfirmSubmitButton>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                  这个专题还没有文章。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row sm:items-center">
        <div className="grid gap-2">
          {state.error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {state.success}
            </p>
          ) : null}
          <p className="text-slate-500">
            当前专题共 {rows.length} 篇文章。排序值越小越靠前；拖拽和规则排序后需要点击保存。
          </p>
        </div>
        <SubmitButton
          disabled={rows.length === 0}
          className={rows.length === 0 ? "pointer-events-none opacity-50" : ""}
        >
          保存排序
        </SubmitButton>
      </div>
    </form>
  );
}

export function topicSortInputClassName() {
  return `${inputClassName} w-28`;
}

export function removeButtonClassName() {
  return buttonClassName("danger", "min-h-8 px-2");
}
