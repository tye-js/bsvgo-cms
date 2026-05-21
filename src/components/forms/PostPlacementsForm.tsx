"use client";

import { useActionState } from "react";

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

function statusLabel(status: PostStatus) {
  switch (status) {
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return "草稿";
  }
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
      <div className="mt-3 grid gap-2 md:grid-cols-3">
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

function PlacementCard({
  post,
  action
}: {
  post: PlacementPost;
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="postId" value={post.id} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-950" title={post.title}>
            {post.title}
          </h2>
          <p className="mt-1 truncate text-xs text-slate-500" title={post.slug}>
            {post.slug}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {post.categoryName} · {statusLabel(post.status)}
          </p>
        </div>
        <div className="grid gap-2 lg:min-w-40">
          <SubmitButton className="w-full min-h-9">保存展示位</SubmitButton>
          {state.error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {state.success}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <PlacementFields
          name="homeFeatured"
          label="首页置顶"
          defaults={placementDefault(post, "homeFeatured")}
        />
        <PlacementFields
          name="homePromoted"
          label="首页推广"
          defaults={placementDefault(post, "homePromoted")}
        />
        <PlacementFields
          name="categoryFeatured"
          label="分类页置顶"
          defaults={placementDefault(post, "categoryFeatured")}
        />
        <PlacementFields
          name="categoryPromoted"
          label="分类页推广"
          defaults={placementDefault(post, "categoryPromoted")}
        />
      </div>
    </form>
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
  if (!posts.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        没有找到匹配的文章。
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <PlacementCard key={post.id} post={post} action={action} />
      ))}
    </div>
  );
}
