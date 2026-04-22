import { cn } from "@/utils/cn";
import { ReactNode } from "react";

interface OnboardingSectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function OnboardingSectionCard({
  title,
  subtitle,
  children,
  className,
  contentClassName,
}: OnboardingSectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white/80 p-4 md:p-5",
        className,
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
