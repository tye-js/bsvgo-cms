import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  className
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-3 focus:ring-slate-100";

export const textareaClassName =
  "min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-3 focus:ring-slate-100";
