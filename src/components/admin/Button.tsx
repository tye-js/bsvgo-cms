import Link from "next/link";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-slate-900 !text-white shadow-sm hover:bg-slate-800",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  ghost: "text-slate-600 hover:bg-slate-100"
};

export function buttonClassName(
  variant: keyof typeof variants = "secondary",
  className?: string
) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
  className
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClassName(variant, className)}>
      {children}
    </Link>
  );
}
