"use client";

import { useActionState, useEffect, useState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { cn } from "@/lib/utils";
import { postMarkLabel, postMarkOptions } from "@/lib/post-mark";
import type { PostMark } from "@/server/db/schema";

type ActionState = {
  error?: string;
  success?: string;
};

export function PostMarkInlineEditor({
  currentMark,
  action
}: {
  currentMark: PostMark;
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [mark, setMark] = useState<PostMark>(currentMark);

  useEffect(() => {
    setMark(currentMark);
  }, [currentMark]);

  return (
    <form action={formAction} className="grid gap-1">
      <fieldset disabled={pending} className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="mark"
            value={mark}
            onChange={(event) => setMark(event.target.value as PostMark)}
            className={cn(inputClassName, "min-h-8 w-full max-w-[150px] text-xs")}
          >
            {postMarkOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className={buttonClassName("secondary", "min-h-8 px-2 text-xs")}
          >
            {pending ? (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : null}
            {pending ? "保存中..." : "保存"}
          </button>
        </div>
      </fieldset>
      <p
        className={cn(
          "min-h-4 text-[11px] leading-4",
          state.error ? "text-rose-600" : state.success ? "text-emerald-600" : "text-slate-400"
        )}
      >
        {state.error
          ? state.error
          : state.success
            ? state.success
            : `当前：${postMarkLabel(mark)}`}
      </p>
    </form>
  );
}
