import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
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
  totalLabel = "Total due",
  totalValue,
  note,
  cta,
  className,
}: CheckoutSummaryProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="font-title text-base font-semibold text-slate-900 sm:text-lg">
          {title}
        </h3>
      </div>

      {/* Line items */}
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className={cn(
                "flex items-start justify-between gap-4 text-sm",
                item.strong && "rounded-lg bg-turf-green/8 px-2.5 py-2",
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-slate-600",
                    item.strong && "font-semibold text-turf-green",
                  )}
                >
                  {item.label}
                </p>
                {item.hint && (
                  <p className="text-xs text-slate-400">{item.hint}</p>
                )}
              </div>
              <p
                className={cn(
                  "shrink-0 font-medium text-slate-800",
                  item.strong && "font-semibold text-turf-green",
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 rounded-xl bg-gradient-to-r from-power-orange/8 to-amber-50/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {totalLabel}
            </span>
            <span className="text-2xl font-bold text-power-orange">
              {totalValue}
            </span>
          </div>
          {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
        </div>

        {cta && <div className="mt-4">{cta}</div>}
      </div>
    </div>
  );
}
