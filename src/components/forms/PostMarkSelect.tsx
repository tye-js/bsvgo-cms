"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { buttonClassName } from "@/components/admin/Button";
import { cn } from "@/lib/utils";
import { postMarkFilterOptions } from "@/lib/post-mark";
import type { PostMarkFilter } from "@/lib/post-mark";

export function PostMarkSelect({
  value,
  name = "mark"
}: {
  value: PostMarkFilter;
  name?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, nextValue);
    params.delete("page");
    router.push(`/posts?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {postMarkFilterOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => apply(option.value)}
          className={cn(
            buttonClassName(
              value === option.value ? "primary" : "secondary",
              "min-h-9 px-3 text-sm"
            )
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
