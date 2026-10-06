import { dayNumber } from "@powermysport/shared-types";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";

/**
 * Which months the calendar offers, what each holds, and which one opens first.
 *
 * ── Why a month at a time ───────────────────────────────────────────────────
 * A calendar of every week to the end of the season was a long scroll with the plan
 * and the details competing for the same height, and parents ask about months ("what
 * is on in November?"). One month fits beside the panel, and a strip of months with
 * their counts keeps the whole season in view without drawing it.
 *
 * An event is in every month it touches, so one that crosses a month end is counted,
 * and drawn, in both. Pure: today is passed in.
 */

export interface MonthChoice {
  /** `YYYY-MM`. */
  key: string;
  /** "October 2026". */
  label: string;
  /** "Oct". */
  short: string;
  /** First and last day of the month, `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** Events that touch the month. */
  count: number;
}

const LONG = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

const monthStart = (key: string): Date => new Date(`${key}-01T00:00:00.000Z`);

export const monthKeyOf = (iso: string): string => iso.slice(0, 7);

/** The month `by` months from `key`, which may be negative. */
export function addMonths(key: string, by: number): string {
  const start = monthStart(key);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + by, 1))
    .toISOString()
    .slice(0, 7);
}

function choiceFor(key: string, items: CalendarItem[], firstYear: number): MonthChoice {
  const start = monthStart(key);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
  const first = dayNumber(from);
  const last = dayNumber(to);
  const count = items.filter((item) => {
    const begins = dayNumber(item.startDate);
    const ends = Math.max(begins, dayNumber(item.endDate ?? item.startDate));
    return ends >= first && begins <= last;
  }).length;
  // "Jan 2027" once the strip crosses into a new year; "Oct" is clear enough before that.
  const short =
    start.getUTCFullYear() === firstYear
      ? SHORT.format(start)
      : `${SHORT.format(start)} ${start.getUTCFullYear()}`;
  return { key, label: LONG.format(start), short, from, to, count };
}

/**
 * This month and the ones after it, as far as there is anything to show and never
 * fewer than `minAhead` more. Past months are not offered: this is a calendar for
 * what is still to come. Capped, so a calendar entry typed with the wrong year cannot
 * stretch the strip across a decade.
 */
export function monthChoices(params: {
  items: CalendarItem[];
  /** `YYYY-MM-DD`. */
  today: string;
  minAhead?: number;
  maxMonths?: number;
}): MonthChoice[] {
  const first = monthKeyOf(params.today);
  const minAhead = params.minAhead ?? 2;
  const maxMonths = params.maxMonths ?? 9;

  const lastWithEvents = params.items.reduce((latest, item) => {
    const key = monthKeyOf((item.endDate ?? item.startDate).slice(0, 10));
    return key > latest ? key : latest;
  }, first);
  const wanted = Math.max(minAhead, monthsBetween(first, lastWithEvents));
  const count = Math.min(maxMonths, wanted + 1);
  const firstYear = monthStart(first).getUTCFullYear();
  return Array.from({ length: count }, (_, i) =>
    choiceFor(addMonths(first, i), params.items, firstYear)
  );
}

function monthsBetween(from: string, to: string): number {
  const a = monthStart(from);
  const b = monthStart(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * The month to open on: this one, unless nothing is left in it. Late in a month the
 * rest of it is a few empty days, and opening on those would hide the events a parent
 * came to look at, so it moves to the first month that has one still to come.
 */
export function defaultMonth(choices: MonthChoice[], items: CalendarItem[], today: string): string {
  const current = choices[0];
  if (!current) return monthKeyOf(today);
  const todayNumber = dayNumber(today);
  const stillAhead = (choice: MonthChoice): boolean =>
    items.some((item) => {
      const begins = dayNumber(item.startDate);
      const ends = Math.max(begins, dayNumber(item.endDate ?? item.startDate));
      return (
        ends >= Math.max(todayNumber, dayNumber(choice.from)) && begins <= dayNumber(choice.to)
      );
    });
  return choices.find(stillAhead)?.key ?? current.key;
}

/** Events that touch a month, in the order given. */
export function itemsInMonth(choice: MonthChoice, items: CalendarItem[]): CalendarItem[] {
  const first = dayNumber(choice.from);
  const last = dayNumber(choice.to);
  return items.filter((item) => {
    const begins = dayNumber(item.startDate);
    const ends = Math.max(begins, dayNumber(item.endDate ?? item.startDate));
    return ends >= first && begins <= last;
  });
}

/**
 * A month in a sentence: how many events, and how they stand. Counted from the
 * events themselves, and only the kinds that are present are named.
 */
export function describeMonth(choice: MonthChoice, items: CalendarItem[]): string {
  const inMonth = itemsInMonth(choice, items);
  if (inMonth.length === 0) return `Nothing on the calendar for ${choice.label} yet.`;

  const planned = inMonth.filter((item) => item.kind === "planned");
  const parts: Array<[number, string]> = [
    [planned.filter((item) => item.status === "entered").length, "entered"],
    [planned.filter((item) => item.status === "shortlisted").length, "still to enter"],
    [planned.filter((item) => item.status === "played").length, "played"],
    [inMonth.filter((item) => item.kind === "suggested").length, "suggested"],
    [inMonth.filter((item) => item.kind === "available").length, "open to enter"],
  ];
  const named = parts.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}`);
  return `${inMonth.length} event${inMonth.length === 1 ? "" : "s"} in ${choice.label}: ${named.join(", ")}.`;
}
