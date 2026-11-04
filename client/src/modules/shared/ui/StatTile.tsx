import { cn } from "@/utils/cn";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export interface StatTileProps {
  label: string;
  /** The figure. Passed as a node so callers can format currency, units, etc. */
  value: ReactNode;
  /** One short line under the figure. */
  sub?: string;
  /** Change against the previous period, as a signed percentage. */
  trend?: { value: number; positive: boolean } | null;
  /** A small icon beside the label. Optional; the figure carries the tile. */
  icon?: ReactNode;
  /** Marks the one figure the page is about. */
  emphasis?: boolean;
  className?: string;
}

/**
 * A single headline figure: a quiet label over a large light numeral. Tiles are
 * separated by fill, not by border or shadow, and the numeral does the work, so
 * a row of them reads as one strip of numbers rather than a grid of cards.
 */
export function StatTile({ label, value, sub, trend, icon, emphasis, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl p-5",
        emphasis ? "border-ink border bg-white" : "bg-paper-deep",
        className
      )}
    >
      <div className="text-ink-muted flex items-center gap-2 text-sm">
        {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-ink mt-3 text-3xl font-light tabular-nums leading-none tracking-tight sm:text-4xl">
        {value}
      </p>
      {(sub || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium tabular-nums",
                trend.positive ? "text-green-700" : "text-red-700"
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {trend.positive ? "+" : "-"}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-ink-muted">{sub}</span>}
        </div>
      )}
    </div>
  );
}
