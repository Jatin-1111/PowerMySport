import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Small generic building blocks used across the checkout steps — extracted
 * from `app/(booking)/checkout/page.tsx`. No behavior changed.
 */

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  icon,
  step,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  step?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="bg-power-orange mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
            {step}
          </span>
        )}
        {icon && !step && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {icon}
          </span>
        )}
        <div>
          <h2 className="font-title text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StepPill({
  steps,
  currentStep,
}: {
  steps: { id: number; label: string }[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{
                  backgroundColor: isComplete ? "#E97316" : isActive ? "#fff" : "#f1f5f9",
                  borderColor: isComplete || isActive ? "#E97316" : "#e2e8f0",
                  color: isComplete ? "#fff" : isActive ? "#E97316" : "#94a3b8",
                }}
                transition={{ duration: 0.3 }}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold"
              >
                {isComplete ? <Check size={12} strokeWidth={3} /> : step.id}
              </motion.div>
              <span
                className={cn(
                  "hidden text-xs font-semibold sm:inline",
                  isActive ? "text-slate-800" : isComplete ? "text-power-orange" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <motion.div
                animate={{
                  backgroundColor: currentStep > step.id ? "#E97316" : "#e2e8f0",
                }}
                transition={{ duration: 0.3 }}
                className="mx-1 h-px w-6 sm:w-10"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BookingSummaryRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3.5 border-b border-slate-100 py-3 last:border-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
