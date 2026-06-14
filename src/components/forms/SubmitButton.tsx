"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClassName } from "@/components/admin/Button";
import { cn } from "@/lib/utils";

const DEFAULT_TIMEOUT_MS = 20000;

function useTimeoutElapsed(timeoutMs: number) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  return timedOut;
}

function PendingButtonContent({
  pendingLabel,
  timeoutLabel,
  timeoutMs
}: {
  pendingLabel: string;
  timeoutLabel: string;
  timeoutMs: number;
}) {
  const timedOut = useTimeoutElapsed(timeoutMs);

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-4 rounded-full border-2 border-current border-t-transparent",
          "animate-spin"
        )}
      />
      {timedOut ? timeoutLabel : pendingLabel}
    </>
  );
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

  return (
    <button type="submit" disabled={pending} className={buttonClassName(variant, className)}>
      {pending ? (
        <PendingButtonContent
          pendingLabel={pendingLabel}
          timeoutLabel={timeoutLabel}
          timeoutMs={timeoutMs}
        />
      ) : (
        children
      )}
    </button>
  );
}

function SubmitTimeoutNoticeContent({
  timeoutMs,
  message
}: {
  timeoutMs: number;
  message: string;
}) {
  const timedOut = useTimeoutElapsed(timeoutMs);

  if (!timedOut) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
    >
      {message}
    </p>
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

  if (!pending) return null;

  return (
    <SubmitTimeoutNoticeContent timeoutMs={timeoutMs} message={message} />
  );
}
