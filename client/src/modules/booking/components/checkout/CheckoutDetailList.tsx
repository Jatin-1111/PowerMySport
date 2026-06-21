import { cn } from "@/utils/cn";

export interface CheckoutDetailItem {
  label: string;
  value: string;
  hint?: string;
}

interface CheckoutDetailListProps {
  items: CheckoutDetailItem[];
  className?: string;
}

export function CheckoutDetailList({
  items,
  className,
}: CheckoutDetailListProps) {
  return (
    <div
      className={cn(
        "divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="flex items-start justify-between gap-4 px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-0.5">
            {item.label}
          </p>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{item.value}</p>
            {item.hint && (
              <p className="mt-0.5 text-xs text-slate-400">{item.hint}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
