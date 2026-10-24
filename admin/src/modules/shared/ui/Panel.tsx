import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  description?: string;
  /** Right-aligned controls in the header row. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove the inner padding, for tables that should run edge to edge. */
  flush?: boolean;
}

/**
 * The standard content surface: a pale tray holding a white sheet. One level
 * only. Do not put a Panel inside a Panel; use spacing and dividers instead.
 */
export function Panel({ title, description, action, children, className, flush }: PanelProps) {
  return (
    <section
      className={cn("rounded-2xl bg-slate-900/[0.04] p-1.5 ring-1 ring-slate-900/5", className)}
    >
      <div className="rounded-[calc(1rem-0.375rem)] bg-white shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(15_23_42/0.04)]">
        {(title || action) && (
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && (
                <p className="mt-1 max-w-[65ch] text-sm text-slate-500">{description}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        <div className={cn(flush ? "pt-3" : "p-5", (title || action) && !flush && "pt-4")}>
          {children}
        </div>
      </div>
    </section>
  );
}

interface MetricItem {
  label: string;
  value: string;
  detail?: string;
}

/**
 * Row of headline numbers separated by hairlines. Reads as one object rather
 * than a set of boxes, and the figures line up across the row.
 */
export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-white p-4">
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
            {item.value}
          </dd>
          {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
        </div>
      ))}
    </dl>
  );
}
