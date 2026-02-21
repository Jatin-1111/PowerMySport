import { Card } from "@/modules/shared/ui/Card";
import { cn } from "@/utils/cn";
import React from "react";

export interface CheckoutSummaryItem {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}

interface CheckoutSummaryProps {
  title?: string;
  items: CheckoutSummaryItem[];
  totalLabel?: string;
  totalValue: string;
  note?: string;
  cta?: React.ReactNode;
  className?: string;
}

export function CheckoutSummary({
  title = "Order Summary",
  items,
  totalLabel = "Total",
  totalValue,
  note,
  cta,
  className,
}: CheckoutSummaryProps) {
  return (
    <Card className={cn("bg-white", className)}>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <div>
              <p
                className={cn("text-slate-600", item.strong && "font-semibold")}
              >
                {item.label}
              </p>
              {item.hint && (
                <p className="text-xs text-slate-400">{item.hint}</p>
              )}
            </div>
            <p className={cn("text-slate-900", item.strong && "font-semibold")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-slate-900">
            {totalLabel}
          </span>
          <span className="text-xl font-bold text-power-orange">
            {totalValue}
          </span>
        </div>
        {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      </div>
      {cta && <div className="mt-5">{cta}</div>}
    </Card>
  );
}
