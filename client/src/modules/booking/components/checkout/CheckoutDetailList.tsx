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
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {item.value}
          </p>
          {item.hint && (
            <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
