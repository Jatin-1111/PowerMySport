"use client";

import { cn } from "@/utils/cn";
import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Small count shown after the label, e.g. open items. Hidden when 0 or undefined. */
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

/**
 * Underline tabs. The selected tab is marked by an orange rule and darker text,
 * so state never depends on colour alone. Arrow keys move between tabs.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next = index;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "admin-tabs-scroll flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_#e2e8f0] [scrollbar-width:none]",
        className
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors",
              selected ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                {tab.count}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity duration-150",
                selected ? "bg-power-orange-solid opacity-100" : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
