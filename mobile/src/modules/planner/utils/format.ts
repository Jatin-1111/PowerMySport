import { dayNumber, planWarnings, type PlannerEdition } from "@powermysport/shared-types";
import type { SeasonPlanEntry } from "../services/planner";

// Hand-written formatters rather than Intl: the phone's JavaScript engine may lack full Intl
// support, and these three outputs (Indian rupee grouping, UTC dates) are simple.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Today as YYYY-MM-DD in UTC, the calendar the planner's dates are stored in. */
export const todayUtc = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

const parts = (iso: string) => {
  const d = new Date(iso);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
};

/** "5 Oct" */
export const shortDay = (iso: string): string => {
  const { m, day } = parts(iso);
  return `${day} ${MONTHS[m]}`;
};

/** "5 Oct 2026" */
export const longDay = (iso: string): string => {
  const { y, m, day } = parts(iso);
  return `${day} ${MONTHS[m]} ${y}`;
};

/** "5 Oct to 10 Oct", or one day when the event is a single day. Words, not dashes. */
export function dateWindow(start: string, end?: string | null): string {
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return shortDay(start);
  return `${shortDay(start)} to ${shortDay(end)}`;
}

/** "October 2026" for an ISO date, from the month it starts in. */
export const monthLabel = (iso: string): string => {
  const { y, m } = parts(iso);
  return `${MONTHS_LONG[m]} ${y}`;
};

export const monthKey = (iso: string): string => iso.slice(0, 7);

/** Rupees with Indian digit grouping (1,50,000), no decimals. */
export function formatInr(amount: number): string {
  const whole = Math.round(amount);
  const digits = String(Math.abs(whole));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${whole < 0 ? "-" : ""}₹${grouped}`;
}

/** "Rs 14,000 to Rs 22,000", or one figure when low and high match. */
export function formatRange(low: number, high: number): string {
  return low === high ? formatInr(low) : `${formatInr(low)} to ${formatInr(high)}`;
}

/** Whole rupees from what a person typed. Null for blank, NaN for anything that is not an amount. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export function groupByMonth<T>(items: T[], startOf: (item: T) => string) {
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  for (const item of items) {
    const start = startOf(item);
    const key = monthKey(start);
    const group = groups.get(key) ?? { key, label: monthLabel(start), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ─── Deadlines ──────────────────────────────────────────────────────────────────

export const DEADLINE_SOON_DAYS = 7;

export type DeadlineState =
  | { kind: "unpublished" }
  | { kind: "passed"; date: string }
  | { kind: "soon"; date: string; daysLeft: number }
  | { kind: "open"; date: string; daysLeft: number };

/** Where an entry deadline stands. A deadline on the 12th is live all day on the 12th. */
export function deadlineState(
  deadline: string | null | undefined,
  today: string = todayUtc()
): DeadlineState {
  if (!deadline) return { kind: "unpublished" };
  const daysLeft = dayNumber(deadline) - dayNumber(today);
  if (daysLeft < 0) return { kind: "passed", date: deadline };
  if (daysLeft <= DEADLINE_SOON_DAYS) return { kind: "soon", date: deadline, daysLeft };
  return { kind: "open", date: deadline, daysLeft };
}

/** Only a published deadline that has passed counts as closed; no deadline is not closed. */
export const entriesClosed = (
  deadline: string | null | undefined,
  today: string = todayUtc()
): boolean => deadlineState(deadline, today).kind === "passed";

function whenText(daysLeft: number): string {
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft} days`;
}

/** The one line under an event about its entry deadline. Always says so when there is none. */
export function deadlineLine(
  deadline: string | null | undefined,
  time?: string,
  today: string = todayUtc()
): string {
  const state = deadlineState(deadline, today);
  if (state.kind === "unpublished") return "Entry deadline not published";
  const at = time ? `, ${time}` : "";
  if (state.kind === "passed") return `Entries closed ${longDay(state.date)}`;
  return `Entries close ${longDay(state.date)}${at} (${whenText(state.daysLeft)})`;
}

// ─── Plan helpers ───────────────────────────────────────────────────────────────

export const STATUS_LABEL = {
  shortlisted: "Not entered yet",
  entered: "Entered",
  played: "Played",
} as const;

export const NEXT_STATUS = { shortlisted: "entered", entered: "played", played: null } as const;

export const NEXT_STATUS_LABEL = {
  shortlisted: "Mark entered",
  entered: "Mark played",
  played: "",
} as const;

/** Clash and tight-gap warnings for the plan's events that are not yet played, keyed by slug. */
export function warningsFor(
  entries: SeasonPlanEntry[],
  calendar: Map<string, PlannerEdition>
): Map<string, string> {
  const events = entries
    .filter((e) => e.status !== "played")
    .map((e) => {
      const live = calendar.get(e.editionSlug);
      return {
        slug: e.editionSlug,
        name: e.name,
        startDate: e.startDate,
        endDate: live?.endDate ?? null,
      };
    });
  return new Map(planWarnings(events).map((w) => [w.slug, w.message]));
}

// ─── What to do next ────────────────────────────────────────────────────────────

export type NextUpKind = "enter-by" | "withdraw-by" | "event";

export interface NextUpItem {
  kind: NextUpKind;
  slug: string;
  name: string;
  date: string;
  daysAway: number;
  underWay: boolean;
  pageUrl?: string;
  time?: string;
  entryClosed?: boolean;
}

const KIND_ORDER: Record<NextUpKind, number> = { "enter-by": 0, "withdraw-by": 1, event: 2 };
const day = (iso: string): string => iso.slice(0, 10);

/**
 * What a parent should look at next, from their plan and the dates AITA prints. Ported from the
 * web planner so the two agree. An event with no published deadline contributes no deadline.
 */
export function nextUp(params: {
  entries: SeasonPlanEntry[];
  calendar: Map<string, PlannerEdition>;
  today: string;
  limit?: number;
}): NextUpItem[] {
  const today = dayNumber(params.today);
  const items: NextUpItem[] = [];

  for (const entry of params.entries) {
    if (entry.status === "played") continue;
    const live = params.calendar.get(entry.editionSlug);
    const pageUrl = live?.official?.pageUrl;
    const base = { slug: entry.editionSlug, name: entry.name };

    if (entry.status === "shortlisted" && live?.registrationDeadlineDate) {
      const date = day(live.registrationDeadlineDate);
      if (!entriesClosed(live.registrationDeadlineDate, params.today)) {
        items.push({
          ...base,
          kind: "enter-by",
          date,
          daysAway: dayNumber(date) - today,
          underWay: false,
          pageUrl,
          time: live.official?.times?.entryCloses,
        });
      }
    }

    if (entry.status === "entered" && live?.official?.withdrawalDeadline) {
      const date = day(live.official.withdrawalDeadline);
      if (dayNumber(date) >= today) {
        items.push({
          ...base,
          kind: "withdraw-by",
          date,
          daysAway: dayNumber(date) - today,
          underWay: false,
          pageUrl,
          time: live.official.times?.withdrawal,
        });
      }
    }

    const start = day(entry.startDate);
    const end = day(live?.endDate ?? entry.startDate);
    const entryClosed =
      entry.status === "shortlisted" && entriesClosed(live?.registrationDeadlineDate, params.today);
    if (dayNumber(end) >= today) {
      items.push({
        ...base,
        kind: "event",
        date: start,
        daysAway: Math.max(0, dayNumber(start) - today),
        underWay: dayNumber(start) < today,
        ...(entryClosed ? { entryClosed: true } : {}),
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        a.daysAway - b.daysAway ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.slug.localeCompare(b.slug)
    )
    .slice(0, params.limit ?? 3);
}

export function nextUpWhen(item: NextUpItem): string {
  if (item.underWay) return "Under way";
  if (item.daysAway === 0) return "Today";
  if (item.daysAway === 1) return "Tomorrow";
  return `In ${item.daysAway} days`;
}

/** "Climb the ranking" and friends, with the sentence that explains each. */
export const GOAL_OPTIONS: Array<{
  value: "points" | "experience" | "home";
  label: string;
  hint: string;
}> = [
  { value: "points", label: "Climb the ranking", hint: "Favours the higher rungs of the circuit." },
  {
    value: "experience",
    label: "Match experience",
    hint: "Favours entry-level events, where the draw is not cut by ranking.",
  },
  { value: "home", label: "Stay close to home", hint: "Favours events in the home state." },
];
