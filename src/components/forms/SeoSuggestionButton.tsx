"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import type { SeoSuggestionOutput, SeoTargetType } from "@/server/ai/openai";

export function SeoSuggestionButton({
  targetType,
  sourceEnTitle,
  sourceEnDescription,
  sourceEnContent,
  sourceZhTitle,
  sourceZhDescription,
  sourceZhContent,
  sourceKeywords,
  onApply
}: {
  targetType: SeoTargetType;
  sourceEnTitle?: () => string;
  sourceEnDescription?: () => string;
  sourceEnContent?: () => string;
  sourceZhTitle?: () => string;
  sourceZhDescription?: () => string;
  sourceZhContent?: () => string;
  sourceKeywords?: () => string;
  onApply: (suggestion: SeoSuggestionOutput) => void;
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
          enTitle: sourceEnTitle?.() ?? "",
          enDescription: sourceEnDescription?.() ?? "",
          enContent: sourceEnContent?.() ?? "",
          zhTitle: sourceZhTitle?.() ?? "",
          zhDescription: sourceZhDescription?.() ?? "",
          zhContent: sourceZhContent?.() ?? "",
          keywords: sourceKeywords?.() ?? ""
        })
      });
      const payload = (await response.json()) as
        | (SeoSuggestionOutput & { error?: string })
        | { error: string };

      if (!response.ok || "error" in payload) {
        setError(payload.error ?? "AI 生成 SEO 建议失败。");
        return;
      }

      onApply(payload);
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
        {isPending ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <Sparkles size={16} />
        )}
        {isPending ? "生成中..." : "生成 SEO 建议"}
      </button>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
