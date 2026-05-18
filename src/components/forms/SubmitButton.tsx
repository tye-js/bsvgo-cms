"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClassName } from "@/components/admin/Button";
import { cn } from "@/lib/utils";

const DEFAULT_TIMEOUT_MS = 20000;

function usePendingTimeout(pending: boolean, timeoutMs: number) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!pending) {
      setTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [pending, timeoutMs]);

  return timedOut;
}

export function SubmitButton({
  children,
  pendingLabel = "保存中...",
  timeoutLabel = "保存超时",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  variant = "primary",
  className
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  timeoutLabel?: string;
  timeoutMs?: number;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const timedOut = usePendingTimeout(pending, timeoutMs);

  return (
    <button type="submit" disabled={pending} className={buttonClassName(variant, className)}>
      {pending ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-4 w-4 rounded-full border-2 border-current border-t-transparent",
            "animate-spin"
          )}
        />
      ) : null}
      {pending ? (timedOut ? timeoutLabel : pendingLabel) : children}
    </button>
  );
}

export function SubmitTimeoutNotice({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  message = "保存时间比预期更久。如果服务器无法及时完成，请等待错误提示后再重新提交。"
}: {
  timeoutMs?: number;
  message?: string;
}) {
  const { pending } = useFormStatus();
  const timedOut = usePendingTimeout(pending, timeoutMs);

  if (!pending || !timedOut) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
    >
      {message}
    </p>
  );
}
