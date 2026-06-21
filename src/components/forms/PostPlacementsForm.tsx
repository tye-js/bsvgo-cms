"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/admin/Badge";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { cn, formatDate, postStatusLabel } from "@/lib/utils";
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
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  placements: {
    homeFeatured: PlacementValue | null;
    homePromoted: PlacementValue | null;
    categoryFeatured: PlacementValue | null;
    categoryPromoted: PlacementValue | null;
  };
};

type PlacementKey = keyof PlacementPost["placements"];

type ActionState = {
  error?: string;
  success?: string;
};

const placementDefinitions: Array<{ key: PlacementKey; label: string }> = [
  { key: "homeFeatured", label: "首页置顶" },
  { key: "homePromoted", label: "首页推广" },
  { key: "categoryFeatured", label: "分类置顶" },
  { key: "categoryPromoted", label: "分类推广" }
];

const placementGridClassName =
  "grid min-w-[1576px] grid-cols-[320px_280px_280px_280px_280px_136px]";

const compactInputClassName =
  "min-h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-3 focus:ring-slate-100";

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

function PlacementSlotCell({
  name,
  label,
  defaults,
  enabled,
  onEnabledChange
}: {
  name: string;
  label: string;
  defaults: {
    enabled: boolean;
    sortOrder: number;
    startsAt: string;
    endsAt: string;
  };
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-2 border-l border-slate-100 px-3 py-3",
        enabled ? "bg-teal-50/40" : "bg-white group-hover:bg-slate-50"
      )}
    >
      <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
        <span className="flex min-w-0 items-center gap-2">
          <input
            type="checkbox"
            name={`placements.${name}.enabled`}
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-700"
          />
          <span className="truncate">{label}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            enabled
              ? "bg-teal-50 text-teal-700 ring-teal-200"
              : "bg-slate-100 text-slate-500 ring-slate-200"
          )}
        >
          {enabled ? "启用" : "关闭"}
        </span>
      </label>

      <div className="grid gap-2">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <label className="grid gap-1 text-[11px] font-medium text-slate-500">
            <span>排序</span>
            <input
              name={`placements.${name}.sortOrder`}
              type="number"
              min={0}
              defaultValue={defaults.sortOrder}
              className={compactInputClassName}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] font-medium text-slate-500">
            <span>开始</span>
            <input
              name={`placements.${name}.startsAt`}
              type="datetime-local"
              defaultValue={defaults.startsAt}
              className={compactInputClassName}
            />
          </label>
        </div>
        <label className="grid gap-1 text-[11px] font-medium text-slate-500">
          <span>结束</span>
          <input
            name={`placements.${name}.endsAt`}
            type="datetime-local"
            defaultValue={defaults.endsAt}
            className={compactInputClassName}
          />
        </label>
      </div>
    </div>
  );
}

function PlacementRow({
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
  const initialEnabledState = useMemo(
    () =>
      placementDefinitions.reduce(
        (result, definition) => ({
          ...result,
          [definition.key]: Boolean(post.placements[definition.key]?.enabled)
        }),
        {} as Record<PlacementKey, boolean>
      ),
    [post.placements]
  );
  const [enabledState, setEnabledState] = useState(initialEnabledState);
  const enabledCount = Object.values(enabledState).filter(Boolean).length;

  return (
    <form
      action={formAction}
      className={cn(
        placementGridClassName,
        "group border-t border-slate-100 text-sm transition hover:bg-slate-50"
      )}
    >
      <input type="hidden" name="postId" value={post.id} />

      <div className="sticky left-0 z-10 grid content-start gap-2 border-r border-slate-100 bg-white px-4 py-3 group-hover:bg-slate-50">
        <Link
          href={`/posts/${post.id}/edit`}
          className="truncate font-medium text-slate-950 hover:text-slate-700"
          title={post.title}
        >
          {post.title}
        </Link>
        <p className="truncate text-xs text-slate-500" title={post.slug}>
          {post.slug}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-32 truncate rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {post.categoryName}
          </span>
          <Badge tone={post.status}>{postStatusLabel(post.status)}</Badge>
          <span className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
            {enabledCount}/4
          </span>
        </div>
        <p className="text-xs text-slate-400">
          更新 {formatDate(post.updatedAt)}
        </p>
      </div>

      {placementDefinitions.map((definition) => (
        <PlacementSlotCell
          key={definition.key}
          name={definition.key}
          label={definition.label}
          defaults={placementDefault(post, definition.key)}
          enabled={enabledState[definition.key]}
          onEnabledChange={(enabled) =>
            setEnabledState((current) => ({
              ...current,
              [definition.key]: enabled
            }))
          }
        />
      ))}

      <div className="grid content-start gap-2 border-l border-slate-100 bg-white px-3 py-3 group-hover:bg-slate-50">
        <SubmitButton className="min-h-8 w-full px-2" pendingLabel="保存中...">
          保存
        </SubmitButton>
        {state.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
            {state.success}
          </p>
        ) : null}
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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div
          className={cn(
            placementGridClassName,
            "bg-slate-50 text-xs uppercase tracking-wide text-slate-500"
          )}
        >
          <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-4 py-3 font-medium">
            文章
          </div>
          {placementDefinitions.map((definition) => (
            <div
              key={definition.key}
              className="border-l border-slate-200 px-3 py-3 font-medium"
            >
              {definition.label}
            </div>
          ))}
          <div className="border-l border-slate-200 px-3 py-3 font-medium">
            操作
          </div>
        </div>

        {posts.map((post) => (
          <PlacementRow
            key={`${post.id}:${post.updatedAt?.toString() ?? ""}`}
            post={post}
            action={action}
          />
        ))}
      </div>
    </section>
  );
}
