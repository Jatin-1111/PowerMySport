import { Card } from "@/modules/shared/ui/Card";
import { cn } from "@/utils/cn";
import React from "react";

interface CheckoutSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CheckoutSection({
  title,
  description,
  action,
  children,
  className,
}: CheckoutSectionProps) {
  return (
    <Card className={cn("bg-white", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
