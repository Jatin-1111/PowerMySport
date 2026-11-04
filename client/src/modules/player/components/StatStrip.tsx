import { StatTile } from "@/modules/shared/ui/StatTile";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

export interface StatStripItem {
  label: string;
  value: ReactNode;
  sub?: string;
}

/**
 * The row of headline counts under a dashboard page's title: a quiet label over a
 * large light numeral, set on the paper-deep fill. It replaces the white bordered
 * cards with shadow and an all-caps label that each page used to repeat inline.
 */
export function StatStrip({ stats, className }: { stats: StatStripItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        className
      )}
    >
      {stats.map((stat) => (
        <StatTile key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} />
      ))}
    </div>
  );
}
