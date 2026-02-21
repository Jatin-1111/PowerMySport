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
    <div className={cn("grid gap-6 lg:grid-cols-3", className)}>
      <div className="space-y-6 lg:col-span-2">{children}</div>
      <aside className="space-y-6 lg:col-span-1">{aside}</aside>
    </div>
  );
}
