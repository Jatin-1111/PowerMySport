"use client";

import { cn } from "@/utils/cn";
import { CreditCard, Users2, IndianRupee } from "lucide-react";
import { formatCurrency } from "@/utils/format";

export type PaymentType = "SINGLE" | "SPLIT";

interface PaymentTypeSelectorProps {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
  totalAmount: number;
  participantCount: number;
  className?: string;
}

export function PaymentTypeSelector({
  value,
  onChange,
  totalAmount,
  participantCount,
  className,
}: PaymentTypeSelectorProps) {
  const amountPerPerson =
    participantCount > 0 ? totalAmount / participantCount : totalAmount;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Single Payment Option */}
      <button
        type="button"
        onClick={() => onChange("SINGLE")}
        className={cn(
          "flex w-full items-start justify-between gap-4 rounded-xl border-2 px-4 py-4 text-left transition-all",
          value === "SINGLE"
            ? "border-power-orange bg-power-orange/5 shadow-sm"
            : "border-slate-200 bg-white hover:border-power-orange/60",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5",
              value === "SINGLE"
                ? "bg-power-orange text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <CreditCard size={18} />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              I'll pay for everyone
            </p>
            <p className="mt-1 text-sm text-slate-600">
              You cover the full amount now. Perfect for treating your friends!
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-power-orange">
              <IndianRupee size={14} />
              <span>{formatCurrency(totalAmount)}</span>
              <span className="text-xs font-normal text-slate-500">
                (Full amount)
              </span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all",
            value === "SINGLE"
              ? "border-power-orange bg-power-orange"
              : "border-slate-300 bg-white",
          )}
        >
          {value === "SINGLE" && (
            <div className="h-full w-full rounded-full bg-white scale-[0.4]" />
          )}
        </div>
      </button>

      {/* Split Payment Option */}
      <button
        type="button"
        onClick={() => onChange("SPLIT")}
        className={cn(
          "flex w-full items-start justify-between gap-4 rounded-xl border-2 px-4 py-4 text-left transition-all",
          value === "SPLIT"
            ? "border-power-orange bg-power-orange/5 shadow-sm"
            : "border-slate-200 bg-white hover:border-power-orange/60",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5",
              value === "SPLIT"
                ? "bg-power-orange text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <Users2 size={18} />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              Split payment equally
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Everyone pays their share. Fair and transparent for the group.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-power-orange">
              <IndianRupee size={14} />
              <span>{formatCurrency(amountPerPerson)}</span>
              <span className="text-xs font-normal text-slate-500">
                per person ({participantCount}{" "}
                {participantCount === 1 ? "person" : "people"})
              </span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all",
            value === "SPLIT"
              ? "border-power-orange bg-power-orange"
              : "border-slate-300 bg-white",
          )}
        >
          {value === "SPLIT" && (
            <div className="h-full w-full rounded-full bg-white scale-[0.4]" />
          )}
        </div>
      </button>

      {/* Info Note */}
      {value === "SPLIT" && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
          <p className="font-medium">How split payment works:</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• Each participant pays their share separately</li>
            <li>• Booking confirmed once all payments are complete</li>
            <li>• You can cover unpaid shares if needed</li>
          </ul>
        </div>
      )}
    </div>
  );
}
