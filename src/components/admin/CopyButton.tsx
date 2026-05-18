"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { buttonClassName } from "@/components/admin/Button";

export function CopyButton({
  value,
  label = "复制",
  copiedLabel = "已复制",
  className
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      className={buttonClassName("secondary", className)}
      onClick={copyValue}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
