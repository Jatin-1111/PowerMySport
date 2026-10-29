import type {
  ChildEventDatePrecision,
  ChildEventKind,
  ChildShareSection,
} from "@powermysport/shared-types";

/**
 * Words and date handling for a child's history.
 *
 * Dates are stored as UTC midnight and a month or a year as its first day, so every format and
 * every conversion here is done in UTC. Formatting in the viewer's zone would show a stored
 * "1 March" as "28 February" for anyone west of UTC.
 */

export const KIND_LABELS: Record<ChildEventKind, string> = {
  tournament_result: "Tournament result",
  coaching_period: "Coaching",
  award: "Award",
  fitness_test: "Fitness test",
  academic_result: "School result",
  test_score: "Test score",
};

export const SECTION_LABELS: Record<ChildShareSection, string> = {
  results: "Results",
  ranking: "Rankings",
  coaching: "Coaching",
  fitness: "Fitness",
  awards: "Awards",
  academics: "Academics",
  videos: "Videos",
};

/** What each kind's form asks, in the words a parent would use. */
export const KIND_HINTS: Record<
  ChildEventKind,
  { title: string; result: string; resultLabel: string }
> = {
  tournament_result: {
    title: "Pune Open U14",
    result: "Quarter final",
    resultLabel: "Result",
  },
  coaching_period: { title: "Ace Tennis Academy", result: "", resultLabel: "Notes" },
  award: { title: "State under 14 champion", result: "Winner", resultLabel: "Position" },
  fitness_test: { title: "Beep test", result: "9.2", resultLabel: "Score" },
  academic_result: { title: "Class 10 board result", result: "92%", resultLabel: "Grade" },
  test_score: { title: "SAT", result: "1380", resultLabel: "Score" },
};

const UTC = "UTC";

export const formatEntryDate = (iso: string, precision: ChildEventDatePrecision): string => {
  const date = new Date(iso);
  if (precision === "year") return String(date.getUTCFullYear());
  if (precision === "month") {
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: UTC });
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UTC,
  });
};

/** A stored date as the value of the input that matches its precision. */
export const toDateInput = (iso: string, precision: ChildEventDatePrecision): string => {
  const day = new Date(iso).toISOString().slice(0, 10);
  if (precision === "year") return day.slice(0, 4);
  if (precision === "month") return day.slice(0, 7);
  return day;
};

/** The value of a date input as the `YYYY-MM-DD` the server takes. Empty or odd input is `null`. */
export const fromDateInput = (value: string, precision: ChildEventDatePrecision): string | null => {
  const text = value.trim();
  if (precision === "year") return /^\d{4}$/.test(text) ? `${text}-01-01` : null;
  if (precision === "month") return /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** The latest date an input accepts: a record of what has happened cannot be in the future. */
export const todayInput = (precision: ChildEventDatePrecision, now: Date = new Date()): string =>
  toDateInput(now.toISOString(), precision);

/** "42 MB", or "850 KB" for a small one. */
export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024))} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Seconds as "1:05". */
export const formatDuration = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** A short, plain label for the tile under the header, e.g. "Tennis · Competitive · since 2021". */
export const headerLine = (child: {
  sport: string | null;
  level: string | null;
  sinceYear: number | null;
}): string =>
  [
    child.sport,
    child.level ? child.level.charAt(0).toUpperCase() + child.level.slice(1) : null,
    child.sinceYear ? `since ${child.sinceYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
