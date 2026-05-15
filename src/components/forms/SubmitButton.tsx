"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClassName } from "@/components/admin/Button";

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
  pendingLabel = "Saving...",
  timeoutLabel = "Save timed out",
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
      {pending ? (timedOut ? timeoutLabel : pendingLabel) : children}
    </button>
  );
}

export function SubmitTimeoutNotice({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  message = "Saving is taking longer than expected. The request will fail automatically if the server cannot finish soon. Wait for the error before submitting again."
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
