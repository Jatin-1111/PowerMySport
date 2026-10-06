"use client";

import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import { describeMonth, type MonthChoice } from "@/modules/planner/utils/calendarMonths";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

/**
 * Which month the calendar shows: one row of tabs, a month each, with how many events
 * it holds. The row is what keeps the whole season in view while only one month is
 * drawn: a parent sees that November is busy and December is empty without opening
 * either. It replaces a header, a pair of arrows, a "this month" button and a sentence
 * that said what the tabs and the key already said.
 *
 * The sentence survives for screen readers, announced when the month changes, and as
 * a visible note only when a month has nothing in it, where it explains why.
 */
export function MonthNav({
  month,
  months,
  items,
  onChange,
  trailing,
}: {
  month: MonthChoice;
  months: MonthChoice[];
  items: CalendarItem[];
  onChange: (key: string) => void;
  /** Something that belongs at the end of the row, such as a filter. */
  trailing?: ReactNode;
}) {
  const summary = describeMonth(month, items);
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-slate-200">
        <div role="group" aria-label="Choose a month" className="flex gap-1 overflow-x-auto">
          {months.map((choice) => {
            const selected = choice.key === month.key;
            return (
              <button
                key={choice.key}
                type="button"
                aria-pressed={selected}
                aria-label={`${choice.label}, ${choice.count} event${choice.count === 1 ? "" : "s"}`}
                onClick={() => onChange(choice.key)}
                className={cn(
                  "-mb-px inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                  selected
                    ? "border-orange-600 text-slate-900"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {choice.short}
                <span aria-hidden className="text-xs font-bold text-slate-500">
                  {choice.count}
                </span>
              </button>
            );
          })}
        </div>
        {trailing}
      </div>

      <p
        aria-live="polite"
        className={month.count === 0 ? "mt-3 text-sm text-slate-600" : "sr-only"}
      >
        {summary}
        {month.count === 0 && " AITA publishes about ten weeks ahead, so later months fill in."}
      </p>
    </div>
  );
}
