"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function AdminToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const message = searchParams.get("toast")?.trim() ?? "";
  const type = searchParams.get("toastType") === "error" ? "error" : "success";

  const clearHref = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("toast");
    params.delete("toastType");
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      router.replace(clearHref, { scroll: false });
    }, type === "error" ? 7000 : 4500);

    return () => window.clearTimeout(timer);
  }, [clearHref, message, router, type]);

  if (!message) return null;

  const Icon = type === "error" ? XCircle : CheckCircle2;

  return (
    <div className="fixed right-4 top-20 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div
        role={type === "error" ? "alert" : "status"}
        className={cn(
          "flex items-start gap-3 rounded-lg border bg-white p-4 text-sm shadow-lg",
          type === "error"
            ? "border-rose-200 text-rose-800"
            : "border-emerald-200 text-emerald-800"
        )}
      >
        <Icon size={18} className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1 leading-6">{message}</p>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="关闭通知"
          onClick={() => router.replace(clearHref, { scroll: false })}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
