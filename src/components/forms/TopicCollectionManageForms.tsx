"use client";

import { useActionState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { PendingFieldset } from "@/components/forms/PendingFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";

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
  status: string;
  sortOrder: number;
};

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
  children
}: {
  collectionId: string;
  posts: CollectionPost[];
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="collectionId" value={collectionId} />
      {children}
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
            当前专题共 {posts.length} 篇文章。排序值越小越靠前。
          </p>
        </div>
        <SubmitButton
          disabled={posts.length === 0}
          className={posts.length === 0 ? "pointer-events-none opacity-50" : ""}
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
