import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      {children}
    </form>
  );
}

export function WideTable({
  children,
  minWidth = "1200px",
  footer
}: {
  children: React.ReactNode;
  minWidth?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-x-auto">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white to-transparent"
          aria-hidden="true"
        />
        <table className="w-full table-fixed text-left text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer ? (
        <div className="border-t border-slate-200 px-5 py-4">{footer}</div>
      ) : null}
    </section>
  );
}

export function StickyActionBar({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex flex-col justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 text-sm shadow-[0_-8px_20px_rgba(15,23,42,0.04)] backdrop-blur sm:flex-row sm:items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DetailDrawer({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </aside>
  );
}

export function InfoList({
  items
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </dt>
          <dd className="min-w-0 text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
