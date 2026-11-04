"use client";

import { cn } from "@/utils/cn";

export interface UnderlineFilterItem<T extends string> {
  label: string;
  value: T;
  count?: number;
}

/**
 * A row of filters set as underlined text with the count after it: the selected
 * one is ink with a rule under it, the rest are muted. It stands in for the
 * rounded pill buttons that used to filter lists on the dashboard pages.
 */
export function UnderlineFilter<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: UnderlineFilterItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-hairline flex gap-x-7 overflow-x-auto overflow-y-hidden border-b",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={selected}
            className={cn(
              "focus-visible:ring-ink shrink-0 whitespace-nowrap border-b-2 px-0.5 py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              selected ? "border-ink text-ink" : "text-ink-muted hover:text-ink border-transparent"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="text-ink-muted ml-2 tabular-nums">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
