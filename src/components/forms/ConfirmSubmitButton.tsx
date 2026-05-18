"use client";

import { useFormStatus } from "react-dom";

import { buttonClassName } from "@/components/admin/Button";

export function ConfirmSubmitButton({
  children,
  message,
  variant = "danger",
  className
}: {
  children: React.ReactNode;
  message: string;
  variant?: "danger" | "secondary" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClassName(variant, className)}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {pending ? "处理中..." : children}
    </button>
  );
}
