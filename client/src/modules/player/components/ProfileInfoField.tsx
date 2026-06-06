import { cn } from "@/utils/cn";
import { ReactNode } from "react";

type ProfileInfoFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function ProfileInfoField({
  label,
  children,
  className,
}: ProfileInfoFieldProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-900 sm:text-base">
        {children}
      </div>
    </div>
  );
}
