"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function PendingFieldset({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} className={cn("grid gap-6 disabled:opacity-70", className)}>
      {children}
    </fieldset>
  );
}
