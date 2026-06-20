import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  icon,
  eyebrow,
  actions,
  metrics,
  className
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  metrics?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("grid gap-4", className)}>
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
      {metrics ? <div>{metrics}</div> : null}
    </header>
  );
}

export function MetricStrip({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

export function MetricTile({
  label,
  value,
  note,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: "neutral" | "active" | "success" | "warning";
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-white",
    active: "border-sky-200 bg-sky-50/50",
    success: "border-emerald-200 bg-emerald-50/50",
    warning: "border-rose-200 bg-rose-50/50"
  }[tone];

  return (
    <div className={cn("rounded-lg border p-4 shadow-sm", toneClass)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
