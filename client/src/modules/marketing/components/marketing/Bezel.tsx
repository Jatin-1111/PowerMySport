import { cn } from "@/utils/cn";
import React from "react";

/**
 * Double-bezel container: an outer tray with a hairline ring, and an inner core
 * whose radius is the outer radius minus the tray padding, so the two curves
 * stay concentric.
 */
export function Bezel({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[2rem] bg-slate-900/[0.04] p-1.5 ring-1 ring-slate-900/[0.06]",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-[calc(2rem-0.375rem)] bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_24px_48px_-28px_rgba(15,23,42,0.12)]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
