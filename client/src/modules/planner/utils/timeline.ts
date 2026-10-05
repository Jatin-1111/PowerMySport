/**
 * Turning a list of events into something a parent reads as a season.
 *
 * Pure, and kept apart from the components for the same reason the eligibility
 * rules are: the claims made here (an event is "closing soon", two events
 * "overlap") are the kind that get quietly wrong, and a table of cases is the
 * only thing that catches it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Month groups ─────────────────────────────────────────────────────────────

export interface MonthGroup<T> {
  /** "2026-10": sortable, and a stable React key. */
  key: string;
  /** "October 2026". */
  label: string;
  items: T[];
}

const monthKeyOf = (iso: string): string => iso.slice(0, 7);

const monthLabelOf = (key: string): string =>
  new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Groups by the month an event STARTS in, keeping the caller's order inside each
 * month. Grouping on the stored UTC date, not the local one, because the stored
 * value is the calendar date the federation printed.
 */
export function groupByMonth<T>(items: T[], startOf: (item: T) => string): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const key = monthKeyOf(startOf(item));
    const group = groups.get(key) ?? { key, label: monthLabelOf(key), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ─── Entry deadlines ──────────────────────────────────────────────────────────

/** Inside this many days, a deadline is worth saying out loud. */
export const DEADLINE_SOON_DAYS = 7;

export type DeadlineState =
  /** The calendar has no deadline for this event. Said so, never guessed. */
  | { kind: "unpublished" }
  | { kind: "passed"; date: string }
  | { kind: "soon"; date: string; daysLeft: number }
  | { kind: "open"; date: string; daysLeft: number };

/**
 * Where an event's entry deadline stands today.
 *
 * "Unpublished" is the common answer: the federation's calendar rarely lists
 * one, and the honest thing to show is that the deadline is unknown rather than
 * an empty space a parent might read as "no deadline".
 */
export function deadlineState(
  deadline: string | null | undefined,
  now: Date = new Date()
): DeadlineState {
  if (!deadline) return { kind: "unpublished" };

  // Compared as calendar dates: a deadline "on the 12th" is still live all day
  // on the 12th, and a timestamp comparison would close it at midnight UTC.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const due = new Date(deadline);
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const daysLeft = Math.round((dueDay - today) / DAY_MS);

  if (daysLeft < 0) return { kind: "passed", date: deadline };
  if (daysLeft <= DEADLINE_SOON_DAYS) return { kind: "soon", date: deadline, daysLeft };
  return { kind: "open", date: deadline, daysLeft };
}

// ─── Plan warnings ────────────────────────────────────────────────────────────

// Defined in shared-types: the recommender on the server must use the same
// definition of a clash as the warnings this page shows.
export { MIN_REST_DAYS, planWarnings, type PlanWarning } from "@powermysport/shared-types";
