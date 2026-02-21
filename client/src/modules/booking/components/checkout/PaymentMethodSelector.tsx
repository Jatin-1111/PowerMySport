import { cn } from "@/utils/cn";
import React from "react";

export interface PaymentMethodOption {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: PaymentMethodOption[];
  className?: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  options,
  className,
}: PaymentMethodSelectorProps) {
  return (
    <div className={cn("grid gap-3", className)}>
      {options.map((option) => {
        const isSelected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all",
              isSelected
                ? "border-power-orange bg-power-orange/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-power-orange/60",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  isSelected
                    ? "bg-power-orange text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {option.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-xs text-slate-500">{option.description}</p>
                )}
              </div>
            </div>
            {option.badge && (
              <span className="rounded-full bg-turf-green/10 px-3 py-1 text-xs font-semibold text-turf-green">
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
