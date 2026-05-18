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
  required,
  value: controlledValue,
  onChange,
  disabled = false
}: {
  name: string;
  defaultValue?: string | null;
  label: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const value = controlledValue ?? uncontrolledValue;

  function updateValue(nextValue: string) {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextValue);
    }
    onChange?.(nextValue);
  }

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
            disabled={disabled}
          >
            <FileText size={14} />
            编辑
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
              mode === "preview" ? "bg-slate-100 text-slate-800" : "text-slate-600"
            )}
            onClick={() => setMode("preview")}
            disabled={disabled}
          >
            <Eye size={14} />
            预览
          </button>
        </div>
      </div>
      {mode === "write" ? (
        <textarea
          name={name}
          required={required}
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          disabled={disabled}
          className={cn(textareaClassName, "min-h-[360px] font-mono leading-6")}
          placeholder="请输入 Markdown 内容..."
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div className="markdown-preview min-h-[360px] rounded-md border border-slate-300 bg-white px-5 py-4">
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-sm text-slate-500">暂无内容可预览。</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
