"use client";

import { useState, useTransition } from "react";

import { buttonClassName } from "@/components/admin/Button";
import type { SeoTargetType } from "@/server/ai/openai";

type SeoSuggestion = {
  title: string;
  description: string;
};

export function SeoSuggestionButton({
  targetType,
  sourceTitle,
  sourceDescription,
  sourceContent,
  onApply
}: {
  targetType: SeoTargetType;
  sourceTitle: () => string;
  sourceDescription?: () => string;
  sourceContent?: () => string;
  onApply: (suggestion: SeoSuggestion) => void;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/seo/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetType,
          title: sourceTitle(),
          description: sourceDescription?.() ?? "",
          content: sourceContent?.() ?? ""
        })
      });
      const payload = (await response.json()) as
        | (SeoSuggestion & { error?: string })
        | { error: string };

      if (!response.ok || "error" in payload) {
        setError(payload.error ?? "AI 生成 SEO 建议失败。");
        return;
      }

      onApply({
        title: payload.title,
        description: payload.description
      });
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={isPending}
        className={buttonClassName("secondary")}
        onClick={generate}
      >
        {isPending ? "AI 生成中..." : "用 AI 生成 SEO 建议"}
      </button>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
