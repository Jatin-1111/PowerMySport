import { cn } from "@/utils/cn";
import React from "react";

interface CheckoutShellProps {
  children: React.ReactNode;
  aside: React.ReactNode;
  className?: string;
}

export function CheckoutShell({
  children,
  aside,
  className,
}: CheckoutShellProps) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]",
        className,
      )}
    >
      <div className="space-y-6">{children}</div>
      <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">{aside}</aside>
    </div>
  );
}
