"use client";

import { useActionState, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { PostStatus } from "@/server/db/schema";

type PlacementValue = {
  enabled: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

type PlacementPost = {
  id: string;
  slug: string;
  categoryId: string;
  title: string;
  categoryName: string;
  status: PostStatus;
  placements: {
    homeFeatured: PlacementValue | null;
    homePromoted: PlacementValue | null;
    categoryFeatured: PlacementValue | null;
    categoryPromoted: PlacementValue | null;
  };
};

type ActionState = {
  error?: string;
  success?: string;
};

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
}

function placementDefault(
  post: PlacementPost,
  key: keyof PlacementPost["placements"]
) {
  const placement = post.placements[key];
  return {
    enabled: placement?.enabled ?? false,
    sortOrder: placement?.sortOrder ?? 0,
    startsAt: toDateInputValue(placement?.startsAt),
    endsAt: toDateInputValue(placement?.endsAt)
  };
}

function PlacementFields({
  name,
  label,
  defaults
}: {
  name: string;
  label: string;
  defaults: {
    enabled: boolean;
    sortOrder: number;
    startsAt: string;
    endsAt: string;
  };
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          name={`placements.${name}.enabled`}
          defaultChecked={defaults.enabled}
          className="h-4 w-4 rounded border-slate-300 text-slate-700"
        />
        {label}
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="排序">
          <input
            name={`placements.${name}.sortOrder`}
            type="number"
            min={0}
            defaultValue={defaults.sortOrder}
            className={inputClassName}
          />
        </Field>
        <Field label="开始时间">
          <input
            name={`placements.${name}.startsAt`}
            type="datetime-local"
            defaultValue={defaults.startsAt}
            className={inputClassName}
          />
        </Field>
        <Field label="结束时间">
          <input
            name={`placements.${name}.endsAt`}
            type="datetime-local"
            defaultValue={defaults.endsAt}
            className={inputClassName}
          />
        </Field>
      </div>
    </div>
  );
}

export function PostPlacementsForm({
  posts,
  action
}: {
  posts: PlacementPost[];
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id ?? "");
  const selectedPost =
    posts.find((post) => post.id === selectedPostId) ?? posts[0];

  return (
    <form
      key={selectedPost?.id ?? "empty"}
      action={formAction}
      className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
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

      {selectedPost ? (
        <>
          <input type="hidden" name="categoryId" value={selectedPost.categoryId} />
          <Field label="文章">
            <select
              name="postId"
              className={inputClassName}
              value={selectedPost.id}
              onChange={(event) => setSelectedPostId(event.target.value)}
            >
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title} / {post.categoryName}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 lg:grid-cols-2">
            <PlacementFields
              name="homeFeatured"
              label="首页置顶"
              defaults={placementDefault(selectedPost, "homeFeatured")}
            />
            <PlacementFields
              name="homePromoted"
              label="首页推广"
              defaults={placementDefault(selectedPost, "homePromoted")}
            />
            <PlacementFields
              name="categoryFeatured"
              label="分类页置顶"
              defaults={placementDefault(selectedPost, "categoryFeatured")}
            />
            <PlacementFields
              name="categoryPromoted"
              label="分类页推广"
              defaults={placementDefault(selectedPost, "categoryPromoted")}
            />
          </div>

          <div className="flex items-center gap-2">
            <SubmitButton>保存展示位</SubmitButton>
            <a href="/posts" className={buttonClassName("secondary")}>
              返回文章
            </a>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">暂无可配置展示位的文章。</p>
      )}
    </form>
  );
}
