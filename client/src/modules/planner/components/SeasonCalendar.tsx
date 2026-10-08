"use client";

import { MonthNav } from "@/modules/planner/components/MonthNav";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import {
  buildCalendar,
  type Bar,
  type BlockedRangeInput,
  type DayCell,
  type WeekRow,
} from "@/modules/planner/utils/calendarLayout";
import type { MonthChoice } from "@/modules/planner/utils/calendarMonths";
import { itemLabel, shortEventLabel } from "@/modules/planner/utils/itemLabel";
import { cn } from "@/utils/cn";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { useState } from "react";

/**
 * One month of the season, by week.
 *
 * Each row is a week, each event a bar across the days it covers. A plan, the
 * suggestions, the dates the child cannot play and the days entries close all sit on
 * one surface, so a parent sees clashes and gaps at a glance instead of comparing
 * three lists.
 *
 * ── What it is built to do with a real month ────────────────────────────────
 * A month of AITA's calendar holds about fifteen events for one age group, all the
 * same length. Drawn as equals they are a wall of identical bars and the parent's own
 * two are lost in it. So there is a hierarchy:
 *
 *   - the plan and the suggestions take the top rows of every week, in strong colour
 *   - what is merely open is quiet: a soft grey bar, named by its place first
 *   - a week with more than a few of those folds the rest into "N more", which opens in
 *     place, so a busy week never pushes the next week off the screen
 *
 * ── What is deliberately not here ───────────────────────────────────────────
 * No drag to move an event: dates are the federation's, and a calendar that let a
 * parent drag a tournament to another week would be a calendar that lies. Selecting
 * a bar opens its detail, where the actions are.
 *
 * ── For people who cannot see it ────────────────────────────────────────────
 * The bars are real buttons with full names, and a bar that only continues an event
 * from the week above is hidden from assistive technology so each event is announced
 * once. The list view states the same events in words, in date order.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Monday, as every wall calendar in India starts. The planner once started weeks on
 * Saturday so that AITA's Saturday-to-Friday events were single bars, but that made a
 * month look like a stack of week-long strips and not like a calendar. Open events are
 * chips on the day they start now, so where the week begins no longer cuts anything in
 * two. Only the parent's own plan and suggestions are bars, and a bar that crosses
 * Sunday simply carries on in the next row, as it does on any calendar.
 */
const WEEK_STARTS_ON = 0;
const HEADERS = [...WEEKDAYS.slice(WEEK_STARTS_ON), ...WEEKDAYS.slice(0, WEEK_STARTS_ON)];

/** 28px: WCAG 2.2 asks for touch targets of at least 24px, and a thumb is not exact. */
const LANE_HEIGHT = 28;
const ROW_MIN_HEIGHT = 96;
/** Rows of events a week draws before the quiet ones fold into "N more". */
const MAX_LANES = 4;
/** Open-event chips one day's cell draws before "N more". */
const MAX_CHIPS = 3;

// The same colours as the plan list and the detail panel (utils/statusStyle.ts): dark
// slate is on the plan, green is entered, orange and dashed is a suggestion. What is
// merely open is a soft grey with no edge, so it recedes behind all of them.
const KIND_STYLE: Record<CalendarItem["kind"], { bar: string; level: string }> = {
  planned: { bar: "bg-slate-800 text-white", level: "text-slate-300" },
  suggested: {
    bar: "border border-dashed border-orange-500 bg-orange-50 text-orange-950",
    level: "text-orange-800",
  },
  available: { bar: "bg-slate-100 text-slate-700 hover:bg-slate-200", level: "text-slate-500" },
};

const ENTERED = { bar: "bg-emerald-700 text-white", level: "text-emerald-100" };
const PLAYED = { bar: "bg-slate-100 text-slate-500", level: "text-slate-500" };

function styleFor(item: CalendarItem): { bar: string; level: string } {
  if (item.kind === "planned" && item.status === "entered") return ENTERED;
  if (item.kind === "planned" && item.status === "played") return PLAYED;
  return KIND_STYLE[item.kind];
}

function EventBar({
  bar,
  selected,
  onSelect,
}: {
  bar: Bar;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  const { item } = bar;
  const style = styleFor(item);
  const { place, level } = shortEventLabel(item);
  const entered = item.kind === "planned" && item.status === "entered";
  // Room for a name: a piece that only carries an event on from the week above, and
  // is a day or two wide, has none and keeps its colour without the text.
  const hasRoom = !(bar.continuesBefore && bar.endCol - bar.startCol < 1);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.slug)}
      aria-label={itemLabel(item)}
      aria-pressed={selected}
      // The piece of an event that carries on from the week above is a pointer
      // convenience only: the first piece is the one announced and tabbed to.
      aria-hidden={bar.continuesBefore ? true : undefined}
      tabIndex={bar.continuesBefore ? -1 : undefined}
      title={item.name}
      style={{
        gridColumn: `${bar.startCol} / ${bar.endCol + 1}`,
        gridRow: bar.lane + 2,
        height: LANE_HEIGHT,
      }}
      className={cn(
        "relative z-10 mx-0.5 flex min-w-0 items-center gap-1.5 px-2 text-left text-[12px] leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        style.bar,
        bar.continuesBefore ? "rounded-l-none" : "rounded-l-md",
        bar.continuesAfter ? "rounded-r-none" : "rounded-r-md",
        item.hasOverlap && "ring-2 ring-red-600",
        selected && "ring-2 ring-orange-500 ring-offset-1"
      )}
    >
      {item.hasOverlap && <AlertTriangle className="h-3 w-3 shrink-0 text-red-300" aria-hidden />}
      {entered && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {hasRoom && (
        <span className="truncate">
          <span className="font-semibold">{place}</span>
          {level && <span className={cn("ml-1.5", style.level)}>{level}</span>}
        </span>
      )}
    </button>
  );
}

/** An event that is merely open: a small chip in the cell of the day it starts. */
function EventChip({
  item,
  selected,
  onSelect,
}: {
  item: CalendarItem;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  const { place } = shortEventLabel(item);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.slug)}
      aria-label={itemLabel(item)}
      aria-pressed={selected}
      title={item.name}
      className={cn(
        "flex h-6 w-full min-w-0 items-center rounded px-1.5 text-left text-[11px] font-medium leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        "bg-slate-100 text-slate-700 hover:bg-slate-200",
        selected && "ring-2 ring-orange-500"
      )}
    >
      <span className="truncate">{place}</span>
    </button>
  );
}

function DayNumber({ day, column }: { day: DayCell; column: number }) {
  // A day of the month before or after is left blank: its number would only compete
  // with the days that are being looked at.
  if (day.outside) return <div style={{ gridColumn: column, gridRow: 1 }} />;
  return (
    <div
      style={{ gridColumn: column, gridRow: 1 }}
      className="min-w-0 px-1.5 pb-1 pt-1.5 text-[12px] leading-tight"
    >
      <div className="flex items-start justify-between gap-0.5">
        <span
          className={cn(
            "inline-block min-w-6 rounded-md px-1 text-center",
            day.isToday
              ? "bg-power-orange-solid font-bold text-white"
              : day.isPast
                ? "text-slate-500"
                : "font-medium text-slate-700"
          )}
        >
          {day.dayOfMonth}
        </span>
        {day.deadlines.length > 0 && (
          <span
            title={day.deadlines.map((item) => `Entries close for ${item.name}`).join(". ")}
            role="img"
            aria-label={day.deadlines.map((item) => `Entries close for ${item.name}`).join(". ")}
            className="text-amber-700"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      {day.blocked?.showLabel && day.blocked.label && (
        <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-700">
          {day.blocked.label}
        </span>
      )}
    </div>
  );
}

function WeekView({
  week,
  selectedSlug,
  onSelect,
  foldable,
  expanded,
  onToggle,
}: {
  week: WeekRow;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /** The week holds more than it draws unless it is expanded. */
  foldable: boolean;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  const showFewer = foldable && expanded;
  const footer = showFewer;
  const hasChips = week.days.some((day) => day.chips.length > 0 || day.moreChips.length > 0);
  const chipRow = week.laneCount + 2;
  const weekOf = week.label.replace(/^Week of /, "");
  return (
    <li aria-label={week.label} className="relative border-t border-slate-200 first:border-t-0">
      {/* The cells themselves: a line between days, and shading for the days that mean
          something (today, dates the child cannot play, the edges of the month). It sits
          behind everything so a bar always reads on top of it. */}
      <div aria-hidden className="absolute inset-0 grid grid-cols-7">
        {week.days.map((day) => (
          <div
            key={day.iso}
            className={cn(
              "border-l border-slate-200 first:border-l-0",
              day.outside && "bg-slate-50",
              day.blocked && "bg-slate-200",
              day.isToday && !day.blocked && "bg-orange-50/70"
            )}
          />
        ))}
      </div>

      <div
        className="relative grid grid-cols-7 pb-1.5"
        style={{
          gridTemplateRows: `auto${week.laneCount > 0 ? ` repeat(${week.laneCount}, ${LANE_HEIGHT}px)` : ""}${hasChips ? " auto" : ""}${footer ? " auto" : ""}`,
          rowGap: 3,
          minHeight: ROW_MIN_HEIGHT,
        }}
      >
        {week.days.map((day, index) => (
          <DayNumber key={day.iso} day={day} column={index + 1} />
        ))}
        {week.bars.map((bar) => (
          <EventBar
            key={`${bar.item.slug}-${week.key}`}
            bar={bar}
            selected={bar.item.slug === selectedSlug}
            onSelect={onSelect}
          />
        ))}
        {hasChips &&
          week.days.map((day, index) => (
            <div
              key={`chips-${day.iso}`}
              style={{ gridColumn: index + 1, gridRow: chipRow }}
              className="relative z-10 flex min-w-0 flex-col gap-1 px-1 pb-1"
            >
              {day.chips.map((item) => (
                <EventChip
                  key={item.slug}
                  item={item}
                  selected={item.slug === selectedSlug}
                  onSelect={onSelect}
                />
              ))}
              {day.moreChips.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggle(week.key)}
                  aria-label={`${day.moreChips.length} more ${day.moreChips.length === 1 ? "event" : "events"} in the week of ${weekOf}`}
                  className="inline-flex h-6 items-center gap-0.5 rounded px-1 text-left text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <ChevronDown className="h-3 w-3" aria-hidden />
                  {day.moreChips.length} more
                </button>
              )}
            </div>
          ))}
        {footer && (
          <button
            type="button"
            onClick={() => onToggle(week.key)}
            aria-expanded={expanded}
            aria-label="Show fewer"
            style={{ gridColumn: "1 / 8", gridRow: chipRow + (hasChips ? 1 : 0) }}
            className="relative z-10 mx-0.5 inline-flex items-center gap-1 justify-self-start rounded-md px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            Show fewer
          </button>
        )}
      </div>
    </li>
  );
}

/** Only what is on screen is explained: a key for things that are not there is noise. */
function Legend({ weeks, items }: { weeks: WeekRow[]; items: CalendarItem[] }) {
  const drawn = new Set<CalendarItem>();
  for (const week of weeks) {
    for (const bar of week.bars) drawn.add(bar.item);
    for (const item of week.hidden) drawn.add(item);
    for (const day of week.days) for (const item of day.chips) drawn.add(item);
  }
  const has = (test: (item: CalendarItem) => boolean) => [...drawn].some(test);
  const days = weeks.flatMap((week) => week.days);

  const swatch = "inline-block h-3 w-5 rounded-sm";
  const entries: Array<{ show: boolean; key: string; mark: React.ReactNode; label: string }> = [
    {
      show: has((i) => i.kind === "planned" && i.status === "shortlisted"),
      key: "plan",
      mark: <span className={cn(swatch, "bg-slate-800")} aria-hidden />,
      label: "On the plan",
    },
    {
      show: has((i) => i.kind === "planned" && i.status === "entered"),
      key: "entered",
      mark: <span className={cn(swatch, "bg-emerald-700")} aria-hidden />,
      label: "Entered",
    },
    {
      show: has((i) => i.kind === "suggested"),
      key: "suggested",
      mark: (
        <span
          className={cn(swatch, "border border-dashed border-orange-500 bg-orange-50")}
          aria-hidden
        />
      ),
      label: "Suggested",
    },
    {
      show: has((i) => i.kind === "available"),
      key: "open",
      mark: <span className={cn(swatch, "bg-slate-100 ring-1 ring-slate-200")} aria-hidden />,
      label: "Open to enter",
    },
    {
      show: days.some((day) => day.blocked),
      key: "blocked",
      mark: <span className={cn(swatch, "bg-slate-200")} aria-hidden />,
      label: "Dates they cannot play",
    },
    {
      show: items.some((item) => item.hasOverlap),
      key: "overlap",
      mark: <AlertTriangle className="h-3 w-3 text-red-700" aria-hidden />,
      label: "Overlap",
    },
    {
      show: days.some((day) => day.deadlines.length > 0),
      key: "closes",
      mark: <Flag className="h-3 w-3 text-amber-700" aria-hidden />,
      label: "Entries close",
    },
  ];
  const shown = entries.filter((entry) => entry.show);
  if (shown.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
      {shown.map((entry) => (
        <li key={entry.key} className="inline-flex items-center gap-1.5">
          {entry.mark}
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

export function SeasonCalendar({
  items,
  blocked,
  today,
  month,
  months,
  onMonthChange,
  selectedSlug,
  onSelect,
  showAvailable,
  onToggleAvailable,
}: {
  items: CalendarItem[];
  blocked: BlockedRangeInput[];
  /** `YYYY-MM-DD`. */
  today: string;
  /** The month drawn, and every month on offer with what each holds. */
  month: MonthChoice;
  months: MonthChoice[];
  onMonthChange: (key: string) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  showAvailable: boolean;
  onToggleAvailable: (next: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const range = { from: month.from, to: month.to };

  // Laid out once as the page would fold it, to learn which weeks hold more than they
  // draw, and again with the weeks the parent has opened. The first is what lets an
  // opened week offer "Show fewer": once it is open it no longer has anything hidden.
  const layoutWith = (expandedWeeks?: ReadonlySet<string>) =>
    buildCalendar({
      items,
      blocked,
      today,
      range,
      maxLanes: MAX_LANES,
      maxChips: MAX_CHIPS,
      weekStartsOn: WEEK_STARTS_ON,
      ...(expandedWeeks ? { expandedWeeks } : {}),
    });
  const folded = layoutWith();
  const foldable = new Set(folded.weeks.filter((week) => week.hidden.length > 0).map((w) => w.key));
  // The week holding the selected event is open, so selecting a folded event (from the
  // list or the "next up" tile) never leaves the parent looking at a week without it.
  const open = new Set(expanded);
  for (const week of folded.weeks) {
    if (selectedSlug && week.hidden.some((hidden) => hidden.slug === selectedSlug)) {
      open.add(week.key);
    }
  }
  const { weeks } = open.size > 0 ? layoutWith(open) : folded;

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <MonthNav
        month={month}
        months={months}
        items={items}
        onChange={onMonthChange}
        trailing={
          <label className="inline-flex cursor-pointer items-center gap-2 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showAvailable}
              onChange={(event) => onToggleAvailable(event.target.checked)}
            />
            Show every event they can enter
          </label>
        }
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div aria-hidden className="grid grid-cols-7 border-b border-slate-200">
          {HEADERS.map((name) => (
            <div
              key={name}
              className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
            >
              {name}
            </div>
          ))}
        </div>
        <ol aria-label={`${month.label}, by week`}>
          {weeks.map((week) => (
            <WeekView
              key={week.key}
              week={week}
              selectedSlug={selectedSlug}
              onSelect={onSelect}
              foldable={foldable.has(week.key)}
              expanded={open.has(week.key)}
              onToggle={toggle}
            />
          ))}
        </ol>
      </div>

      <div className="mt-3">
        <Legend weeks={weeks} items={items} />
      </div>
    </div>
  );
}
