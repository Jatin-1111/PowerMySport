import { dayNumber } from "@powermysport/shared-types";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";

/**
 * From a list of events to the weeks a calendar draws.
 *
 * ── Why a grid of weeks, not a strip ────────────────────────────────────────
 * Weeks stack as rows of seven days and an event is a bar across the days it
 * covers, continuing onto the next row when it crosses a week. That is the layout
 * every parent already reads, it fits a phone at seven narrow columns, and it
 * needs no sideways scrolling or zoom, which a long horizontal timeline would.
 *
 * ── Dates ───────────────────────────────────────────────────────────────────
 * Everything is the UTC calendar date. The calendar stores each event as midnight
 * UTC of the date the federation printed, so the UTC date IS the date, and reading
 * it in local time would put an event on the wrong day for anyone west of
 * Greenwich. Weeks start on Monday.
 *
 * Pure on purpose: no React, no clock (today is passed in), so the awkward cases,
 * an event that spans three weeks, two that overlap, a blocked range that crosses
 * a month, are a table of tests and not a look at a screen.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar publishes about ten weeks ahead, so a quarter is always on screen. */
export const MIN_WEEKS = 12;
/** A cap: a calendar entry typed with the wrong year must not stretch the page. */
export const MAX_WEEKS = 30;

export interface BlockedRangeInput {
  from: string;
  to: string;
  label?: string | undefined;
}

export interface DayCell {
  /** Whole days since the epoch. */
  day: number;
  iso: string;
  dayOfMonth: number;
  /** "Nov", set on the 1st of a month and on the first cell of the grid. */
  monthLabel: string | null;
  isToday: boolean;
  isPast: boolean;
  /** Monday is 0 and Sunday is 6, whichever day the week starts on. */
  weekday: number;
  blocked: { label: string | undefined; showLabel: boolean } | null;
  /** Planned or suggested events whose entries close on this day. */
  deadlines: CalendarItem[];
  /**
   * True for a day that belongs to the week drawn but not to the month asked for: the
   * end of the month before in the first row, the start of the next in the last.
   */
  outside: boolean;
}

export interface Bar {
  item: CalendarItem;
  /** 1 to 7, inclusive, within this week. */
  startCol: number;
  endCol: number;
  /** 0-based row under the day numbers. */
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface WeekRow {
  key: string;
  startDay: number;
  /** "Week of 5 Oct", for people who cannot see the grid. */
  label: string;
  days: DayCell[];
  bars: Bar[];
  laneCount: number;
  /**
   * Events in this week left out of `bars` to keep a busy week readable, soonest first.
   * Never a planned or suggested event: those are placed first and are never hidden.
   */
  hidden: CalendarItem[];
}

export interface CalendarLayout {
  weeks: WeekRow[];
  /** Events that start after the last week drawn. Said, never silently dropped. */
  later: number;
}

/** Monday is 0 and Sunday is 6. 1970-01-01, day 0, was a Thursday. */
export const weekdayOf = (day: number): number => (((day + 3) % 7) + 7) % 7;

/**
 * The first day of the week a day falls in. `weekStartsOn` is a weekday as above and
 * defaults to Monday. A tournament week is Saturday to Friday, so the planner draws
 * its weeks from Saturday and a standard event is one unbroken bar.
 */
export const startOfWeek = (day: number, weekStartsOn = 0): number =>
  day - ((weekdayOf(day) - weekStartsOn + 7) % 7);

const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

const SHORT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

const dayRange = (item: CalendarItem): { start: number; end: number } => {
  const start = dayNumber(item.startDate);
  // An end before the start is a data error; one day is the safe reading.
  const end = Math.max(start, dayNumber(item.endDate ?? item.startDate));
  return { start, end };
};

/** Who gets the top rows of a week: a decision, then a proposal, then what is merely open. */
const KIND_RANK: Record<CalendarItem["kind"], number> = { planned: 0, suggested: 1, available: 2 };

/** A deadline is worth a flag on its day for events a parent is acting on. */
const flaggedKinds = new Set<CalendarItem["kind"]>(["planned", "suggested"]);

export function buildCalendar(params: {
  items: CalendarItem[];
  blocked: BlockedRangeInput[];
  /** `YYYY-MM-DD`. Passed in so a test, and a render, always agree on today. */
  today: string;
  /**
   * Draw only the weeks that hold these days, `YYYY-MM-DD` and inclusive: a month, in
   * practice. Without it the layout runs from this week for a quarter or more.
   */
  range?: { from: string; to: string };
  /**
   * The most rows of events a week draws before the rest are folded into "N more".
   * A week with a plan and suggestions always draws as many as they need.
   */
  maxLanes?: number;
  /** The weekday each row starts on: Monday is 0 (the default) and Saturday is 5. */
  weekStartsOn?: number;
  /** Weeks, by `key`, drawn in full whatever `maxLanes` says. */
  expandedWeeks?: ReadonlySet<string>;
  minWeeks?: number;
  maxWeeks?: number;
}): CalendarLayout {
  const { items, blocked, range } = params;
  const minWeeks = params.minWeeks ?? MIN_WEEKS;
  const maxWeeks = params.maxWeeks ?? MAX_WEEKS;
  const maxLanes = params.maxLanes ?? Infinity;
  const weekStartsOn = params.weekStartsOn ?? 0;

  const today = dayNumber(params.today);
  const rangeFrom = range ? dayNumber(range.from) : null;
  const rangeTo = range ? dayNumber(range.to) : null;

  const firstDay =
    rangeFrom !== null ? startOfWeek(rangeFrom, weekStartsOn) : startOfWeek(today, weekStartsOn);
  const minLast = firstDay + minWeeks * 7 - 1;
  const maxLast =
    rangeTo !== null ? startOfWeek(rangeTo, weekStartsOn) + 6 : firstDay + maxWeeks * 7 - 1;

  const ranged = items.map((item) => ({ item, ...dayRange(item) }));
  // An event is drawn if it touches the month asked for. The leading and trailing days
  // of the first and last week belong to the months either side, and an event that
  // lies wholly in those days is theirs, not this month's.
  const windowFrom = rangeFrom ?? firstDay;
  const windowTo = rangeTo ?? maxLast;
  const visible = ranged.filter((entry) => entry.end >= windowFrom && entry.start <= windowTo);
  const contentLast = visible.reduce((latest, entry) => Math.max(latest, entry.end), minLast);
  const lastDay = rangeTo !== null ? maxLast : Math.min(Math.max(minLast, contentLast), maxLast);
  const weekCount = Math.ceil((lastDay - firstDay + 1) / 7);

  const blockedDays = blocked.map((range) => ({
    from: dayNumber(range.from),
    to: dayNumber(range.to),
    label: range.label,
  }));

  const deadlineDay = (item: CalendarItem): number | null => {
    const deadline = item.edition.registrationDeadlineDate;
    if (!deadline || !flaggedKinds.has(item.kind) || item.status === "played") return null;
    const day = dayNumber(deadline);
    // A deadline already gone is not a flag, it is history.
    return day >= today ? day : null;
  };

  const weeks: WeekRow[] = [];
  for (let w = 0; w < weekCount; w += 1) {
    const startDay = firstDay + w * 7;
    const endDay = startDay + 6;

    const days: DayCell[] = [];
    for (let col = 0; col < 7; col += 1) {
      const day = startDay + col;
      const date = new Date(day * DAY_MS);
      const range = blockedDays.find((entry) => day >= entry.from && day <= entry.to);
      days.push({
        day,
        iso: isoOf(day),
        dayOfMonth: date.getUTCDate(),
        monthLabel: date.getUTCDate() === 1 || (w === 0 && col === 0) ? MONTH.format(date) : null,
        isToday: day === today,
        isPast: day < today,
        weekday: weekdayOf(day),
        outside: rangeFrom !== null && rangeTo !== null && (day < rangeFrom || day > rangeTo),
        blocked: range ? { label: range.label, showLabel: day === range.from || col === 0 } : null,
        deadlines: visible
          .filter((entry) => deadlineDay(entry.item) === day)
          .map((entry) => entry.item),
      });
    }

    // Longer bars first, so a long event takes the top lane and short ones fill in
    // beneath it, which reads better than the reverse.
    const inWeek = visible
      .filter((entry) => entry.start <= endDay && entry.end >= startDay)
      .map((entry) => ({
        ...entry,
        startCol: Math.max(entry.start, startDay) - startDay + 1,
        endCol: Math.min(entry.end, endDay) - startDay + 1,
      }))
      .sort(
        (a, b) =>
          a.startCol - b.startCol ||
          b.endCol - b.startCol - (a.endCol - a.startCol) ||
          a.item.slug.localeCompare(b.item.slug)
      );

    // The parent's own events and the suggestions take the top rows, and the rest of
    // what is open fills in beneath them. Without this a plan of two events was lost
    // among fifteen others of the same weight.
    const ordered = [...inWeek].sort(
      (a, b) =>
        KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
        a.startCol - b.startCol ||
        b.endCol - b.startCol - (a.endCol - a.startCol) ||
        a.item.slug.localeCompare(b.item.slug)
    );
    const occupied: boolean[][] = [];
    const placed = ordered.map((entry) => {
      let lane = 0;
      while (
        occupied[lane] &&
        occupied[lane]!.slice(entry.startCol, entry.endCol + 1).some(Boolean)
      ) {
        lane += 1;
      }
      const row = (occupied[lane] ??= []);
      for (let col = entry.startCol; col <= entry.endCol; col += 1) row[col] = true;
      return { entry, lane };
    });

    const importantLanes = placed.reduce(
      (most, { entry, lane }) => (KIND_RANK[entry.item.kind] < 2 ? Math.max(most, lane + 1) : most),
      0
    );
    const cap = params.expandedWeeks?.has(isoOf(startDay))
      ? Infinity
      : Math.max(maxLanes, importantLanes);

    const shown = placed.filter(({ lane }) => lane < cap);
    const bars: Bar[] = shown
      .map(({ entry, lane }) => ({
        item: entry.item,
        startCol: entry.startCol,
        endCol: entry.endCol,
        lane,
        continuesBefore: entry.start < startDay,
        continuesAfter: entry.end > endDay,
      }))
      .sort((a, b) => a.startCol - b.startCol || a.lane - b.lane);
    const hidden = placed
      .filter(({ lane }) => lane >= cap)
      .map(({ entry }) => entry)
      .sort((a, b) => a.startCol - b.startCol || a.item.slug.localeCompare(b.item.slug))
      .map((entry) => entry.item);
    const laneCount = shown.reduce((most, { lane }) => Math.max(most, lane + 1), 0);

    weeks.push({
      key: isoOf(startDay),
      startDay,
      label: `Week of ${SHORT.format(new Date(startDay * DAY_MS))}`,
      days,
      bars,
      laneCount,
      hidden,
    });
  }

  return {
    weeks,
    // A month shows what is in it, and the month strip says what is elsewhere.
    later: range ? 0 : ranged.filter((entry) => entry.start > maxLast).length,
  };
}
