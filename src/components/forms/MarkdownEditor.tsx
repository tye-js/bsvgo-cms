"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, FileText } from "lucide-react";

import { textareaClassName } from "@/components/admin/Field";
import { cn } from "@/lib/utils";

export function MarkdownEditor({
  name,
  defaultValue = "",
  label,
  required
}: {
  name: string;
  defaultValue?: string | null;
  label: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-1">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
              mode === "write" ? "bg-slate-100 text-slate-800" : "text-slate-600"
            )}
            onClick={() => setMode("write")}
          >
            <FileText size={14} />
            Write
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
              mode === "preview" ? "bg-slate-100 text-slate-800" : "text-slate-600"
            )}
            onClick={() => setMode("preview")}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>
      </div>
      {mode === "write" ? (
        <textarea
          name={name}
          required={required}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={cn(textareaClassName, "min-h-[360px] font-mono leading-6")}
          placeholder="Write Markdown content..."
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div className="markdown-preview min-h-[360px] rounded-md border border-slate-300 bg-white px-5 py-4">
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-sm text-slate-500">No content to preview.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
