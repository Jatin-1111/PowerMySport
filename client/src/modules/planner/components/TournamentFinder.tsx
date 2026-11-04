"use client";

import { Collapsible } from "@/modules/planner/components/Collapsible";
import { SeasonCalendar } from "@/modules/planner/components/SeasonCalendar";
import { Timeline } from "@/modules/planner/components/Timeline";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import type { MonthChoice } from "@/modules/planner/utils/calendarMonths";
import type { BlockedRangeInput } from "@/modules/planner/utils/calendarLayout";
import {
  filtersActive,
  NO_FILTERS,
  type FinderFilters,
} from "@/modules/planner/utils/finderFilters";
import { cn } from "@/utils/cn";
import type { ReachVerdict, Shortlist } from "@powermysport/shared-types";
import { motion } from "framer-motion";
import { CalendarDays, List } from "lucide-react";
import { BLOCK, QUICK } from "@/modules/planner/utils/motion";
import type { RefObject } from "react";

/**
 * The one place to look for a tournament: a list of events with what to do about each,
 * or the same events on a calendar, filtered by where they are and how big they are.
 *
 * It replaces two sections, "season calendar" and "all tournaments", that held the same
 * events twice. The list is the way in, since each event there can be added to the plan;
 * the calendar is for checking clashes and is offered where there is room for a grid.
 *
 * It is controlled from outside because a button elsewhere ("browse all") opens it, and
 * because the board prices and opens events from other places.
 */

const FIELD =
  "min-h-11 rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink";

export type FinderView = "calendar" | "list";

export function TournamentFinder({
  containerRef,
  description,
  open,
  onOpenChange,
  isWide,
  view,
  onViewChange,
  filters,
  onFiltersChange,
  options,
  shortlist,
  hasMatches,
  plannedSlugs,
  isAdding,
  onAdd,
  reach,
  calendar,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isWide: boolean;
  view: FinderView;
  onViewChange: (view: FinderView) => void;
  filters: FinderFilters;
  onFiltersChange: (filters: FinderFilters) => void;
  options: { states: string[]; ladders: string[] };
  /** Already filtered. */
  shortlist: Shortlist;
  /** Whether anything is left after filtering, to say so rather than show a blank. */
  hasMatches: boolean;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
  reach: Record<string, ReachVerdict>;
  calendar: {
    items: CalendarItem[];
    blocked: BlockedRangeInput[];
    today: string;
    month: MonthChoice;
    months: MonthChoice[];
    onMonthChange: (key: string) => void;
    selectedSlug: string | null;
    onSelect: (slug: string) => void;
    showAvailable: boolean;
    onToggleAvailable: (next: boolean) => void;
  };
}) {
  const showGrid = isWide && view === "calendar";
  const active = filtersActive(filters);

  return (
    <motion.div variants={BLOCK} ref={containerRef} className="min-w-0">
      <Collapsible
        tour="calendar"
        title="Find tournaments"
        heavy
        description={description}
        open={open}
        onOpenChange={onOpenChange}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-ink-body flex flex-col gap-1 text-sm font-medium">
              State
              <select
                className={FIELD}
                value={filters.state}
                onChange={(event) => onFiltersChange({ ...filters, state: event.target.value })}
              >
                <option value="">Anywhere</option>
                {options.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-ink-body flex flex-col gap-1 text-sm font-medium">
              Level
              <select
                className={FIELD}
                value={filters.ladder}
                onChange={(event) => onFiltersChange({ ...filters, ladder: event.target.value })}
              >
                <option value="">Any level</option>
                {options.ladders.map((ladder) => (
                  <option key={ladder} value={ladder}>
                    {ladder}
                  </option>
                ))}
              </select>
            </label>
            {active && (
              <button
                type="button"
                onClick={() => onFiltersChange(NO_FILTERS)}
                className="text-ink-body hover:text-ink inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
          </div>

          {isWide && (
            <div role="group" aria-label="How to show tournaments" className="flex gap-1">
              {(
                [
                  ["list", "List", List],
                  ["calendar", "Calendar", CalendarDays],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => onViewChange(value)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    view === value
                      ? "border-ink bg-ink text-white"
                      : "border-hairline text-ink-body hover:border-ink/40 bg-white"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <motion.div
          key={`${view}-${isWide}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={QUICK}
        >
          {active && !hasMatches ? (
            <p className="text-ink-body text-sm leading-relaxed">
              No tournaments match these filters.{" "}
              <button
                type="button"
                onClick={() => onFiltersChange(NO_FILTERS)}
                className="font-semibold underline underline-offset-4"
              >
                Clear filters
              </button>
            </p>
          ) : showGrid ? (
            <SeasonCalendar
              items={calendar.items}
              blocked={calendar.blocked}
              today={calendar.today}
              month={calendar.month}
              months={calendar.months}
              onMonthChange={calendar.onMonthChange}
              selectedSlug={calendar.selectedSlug}
              onSelect={calendar.onSelect}
              showAvailable={calendar.showAvailable}
              onToggleAvailable={calendar.onToggleAvailable}
            />
          ) : (
            <Timeline
              shortlist={shortlist}
              plannedSlugs={plannedSlugs}
              isAdding={isAdding}
              onAdd={onAdd}
              reach={reach}
            />
          )}
        </motion.div>
      </Collapsible>
    </motion.div>
  );
}
