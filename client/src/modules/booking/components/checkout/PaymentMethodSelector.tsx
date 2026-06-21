import { cn } from "@/utils/cn";
import { Check } from "lucide-react";
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
    <div className={cn("grid gap-2.5", className)}>
      {options.map((option) => {
        const isSelected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
              isSelected
                ? "border-power-orange bg-power-orange/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  isSelected
                    ? "bg-power-orange text-white shadow-sm"
                    : "bg-slate-100 text-slate-500",
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
            <div className="flex shrink-0 items-center gap-2">
              {option.badge && (
                <span className="rounded-full bg-turf-green/10 px-2.5 py-0.5 text-xs font-semibold text-turf-green">
                  {option.badge}
                </span>
              )}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                  isSelected
                    ? "border-power-orange bg-power-orange"
                    : "border-slate-300 bg-white",
                )}
              >
                {isSelected && (
                  <Check size={11} strokeWidth={3} className="text-white" />
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
