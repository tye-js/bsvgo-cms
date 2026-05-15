import { cn } from "@/lib/utils";

const statusStyles = {
  draft: "bg-stone-100 text-stone-700 ring-stone-200",
  published: "bg-teal-50 text-teal-700 ring-teal-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
  admin: "bg-slate-100 text-slate-700 ring-slate-200",
  editor: "bg-slate-50 text-slate-600 ring-slate-200"
};

export function Badge({
  children,
  tone = "archived"
}: {
  children: React.ReactNode;
  tone?: keyof typeof statusStyles;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
        statusStyles[tone]
      )}
    >
      {children}
    </span>
  );
}
