import type {
  ChildEventDatePrecision,
  ChildEventKind,
  ChildTimelineRow,
} from "@powermysport/shared-types";

/**
 * Words and date handling for a child's record on the phone. The words match the website
 * (client/src/modules/my-child/utils/format.ts) so a parent sees the same labels in both places.
 *
 * Dates are stored as UTC midnight, and a month or a year as its first day, so everything here is
 * read and built in UTC. A stored "1 March" must never turn into "28 February".
 */

/** The kinds the phone offers, in the order shown. Coaching spells stay on the website for now. */
export const ENTRY_KINDS: ChildEventKind[] = [
  "tournament_result",
  "award",
  "fitness_test",
  "academic_result",
  "test_score",
];

export const KIND_LABELS: Record<ChildEventKind, string> = {
  tournament_result: "Tournament result",
  coaching_period: "Coaching",
  award: "Award",
  fitness_test: "Fitness test",
  academic_result: "School result",
  test_score: "Test score",
};

/** What each kind's form asks, in the words a parent would use. */
export const KIND_HINTS: Record<
  ChildEventKind,
  { title: string; result: string; resultLabel: string }
> = {
  tournament_result: { title: "Pune Open U14", result: "Quarter final", resultLabel: "Result" },
  coaching_period: { title: "Ace Tennis Academy", result: "", resultLabel: "Notes" },
  award: { title: "State under 14 champion", result: "Winner", resultLabel: "Position" },
  fitness_test: { title: "Beep test", result: "9.2", resultLabel: "Score" },
  academic_result: { title: "Class 10 board result", result: "92%", resultLabel: "Grade" },
  test_score: { title: "SAT", result: "1380", resultLabel: "Score" },
};

export const PRECISIONS: { value: ChildEventDatePrecision; label: string }[] = [
  { value: "day", label: "Exact day" },
  { value: "month", label: "Month and year" },
  { value: "year", label: "Year only" },
];

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_PARTS: DateParts = { day: "", month: "", year: "" };

/** The earliest year an entry may carry, the same floor the website's year box uses. */
export const EARLIEST_YEAR = 1990;

export type DateResult = { ok: true; iso: string } | { ok: false; error: string };

/**
 * The boxes as the `YYYY-MM-DD` the server takes: a month is sent as its first day and a year as
 * 1 January. A record of what has happened cannot be in the future.
 */
export function dateFromParts(
  parts: DateParts,
  precision: ChildEventDatePrecision,
  now: Date = new Date()
): DateResult {
  const year = Number(parts.year);
  const month = Number(precision === "year" ? 1 : parts.month);
  const day = Number(precision === "day" ? parts.day : 1);

  if (!/^\d{4}$/.test(parts.year) || year < EARLIEST_YEAR) {
    return { ok: false, error: `Enter a four digit year, ${EARLIEST_YEAR} or later.` };
  }
  if (precision !== "year" && (!month || month < 1 || month > 12)) {
    return { ok: false, error: "Enter a month between 1 and 12." };
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: "That date does not exist." };
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() > today) return { ok: false, error: "The date cannot be in the future." };

  const pad = (n: number) => String(n).padStart(2, "0");
  return { ok: true, iso: `${year}-${pad(month)}-${pad(day)}` };
}

/** A stored date as the boxes that match its precision, for editing. */
export function partsFromIso(iso: string, precision: ChildEventDatePrecision): DateParts {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_PARTS;
  return {
    year: String(date.getUTCFullYear()),
    month: precision === "year" ? "" : String(date.getUTCMonth() + 1),
    day: precision === "day" ? String(date.getUTCDate()) : "",
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A parent rarely knows the day, so show only as much of the date as was recorded. */
export function formatWhen(row: Pick<ChildTimelineRow, "occurredOn" | "datePrecision">): string {
  const date = new Date(row.occurredOn);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  if (row.datePrecision === "year") return String(year);
  const month = MONTHS[date.getUTCMonth()];
  if (row.datePrecision === "month") return `${month} ${year}`;
  return `${date.getUTCDate()} ${month} ${year}`;
}

/** The server needs an https link; a bare "example.com" is completed rather than refused. */
export function cleanLink(value: string): { ok: true; url: string | null } | { ok: false } {
  const text = value.trim();
  if (!text) return { ok: true, url: null };
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return /^https:\/\/[^\s/.]+\.[^\s]+$/i.test(url) ? { ok: true, url } : { ok: false };
}
