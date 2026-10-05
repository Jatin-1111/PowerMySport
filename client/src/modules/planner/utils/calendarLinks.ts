import { absoluteUrl } from "@/lib/seo";

/**
 * Putting a tournament on a parent's own calendar.
 *
 * ── Why a link and a file, and not a Google sign-in ─────────────────────────
 * Writing to someone's Google Calendar through the API needs their consent, a
 * verified OAuth app and a refresh-token store, all to save a date. A prefilled
 * "new event" link does the same job for one event, and an `.ics` file covers
 * the whole plan and every other calendar app. Neither holds a credential, so
 * there is nothing here to leak or to expire.
 *
 * ── Why every event is all-day ──────────────────────────────────────────────
 * The calendar publishes a start date and sometimes an end date, never a time.
 * Inventing a 9am start would put a false time in someone's phone. An all-day
 * event says exactly what we know.
 */

export interface CalendarEdition {
  slug?: string | undefined;
  name: string;
  /** ISO timestamp. Only the calendar date is used, read in UTC (see below). */
  startDate: string;
  endDate?: string | null | undefined;
  city?: string | null | undefined;
  venue?: string | null | undefined;
  state?: string | null | undefined;
  ageGroups?: string[] | undefined;
  /** Present only when the federation published one. Never filled in by us. */
  registrationDeadlineDate?: string | null | undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The edition dates are stored as midnight UTC of the calendar date the
 * federation printed, so the UTC components are the date. Reading them in local
 * time would show a parent west of Greenwich the day before.
 */
const toCompactDate = (date: Date): string =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;

/** All-day events end on the day AFTER the last day: the end is exclusive. */
const dayRange = (edition: CalendarEdition): { start: string; endExclusive: string } => {
  const start = new Date(edition.startDate);
  const lastDay = edition.endDate ? new Date(edition.endDate) : start;
  // An end before the start is a data error; one day is the safe reading.
  const last = lastDay.getTime() >= start.getTime() ? lastDay : start;
  return {
    start: toCompactDate(start),
    endExclusive: toCompactDate(new Date(last.getTime() + DAY_MS)),
  };
};

export const eventLocation = (edition: CalendarEdition): string =>
  [edition.venue, edition.city, edition.state].filter(Boolean).join(", ");

const eventDetails = (edition: CalendarEdition): string => {
  const lines: string[] = [];
  if (edition.ageGroups?.length) lines.push(`Age groups: ${edition.ageGroups.join(", ")}`);
  if (edition.registrationDeadlineDate) {
    lines.push(
      `Entry deadline: ${new Date(edition.registrationDeadlineDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })}`
    );
  }
  lines.push("Dates can change. Check the fact sheet before you travel.");
  if (edition.slug) lines.push(absoluteUrl(`/tournaments/${edition.slug}`));
  return lines.join("\n");
};

/** A prefilled Google Calendar "new event" page for one tournament. */
export function googleCalendarUrl(edition: CalendarEdition): string {
  const { start, endExclusive } = dayRange(edition);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: edition.name,
    dates: `${start}/${endExclusive}`,
    details: eventDetails(edition),
  });
  const location = eventLocation(edition);
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── .ics ─────────────────────────────────────────────────────────────────────

/** RFC 5545 text escaping. Order matters: the backslash goes first. */
const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * Lines over 75 octets must be folded: break, then CRLF and one space. Counted
 * in UTF-8 bytes, not characters, so a name with an accent does not overflow.
 */
const fold = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  // The first line may use 75 octets, continuations 74 (the leading space).
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = char;
      bytes = size;
      limit = 74;
    } else {
      current += char;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const stamp = (now: Date): string =>
  `${toCompactDate(now)}T${String(now.getUTCHours()).padStart(2, "0")}${String(
    now.getUTCMinutes()
  ).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

/**
 * A calendar file for a set of tournaments.
 *
 * The UID is derived from the slug, so importing the same file twice updates the
 * events instead of duplicating them. An event with no slug gets a UID from its
 * name and date for the same reason.
 *
 * `now` is a parameter so the output is reproducible in a test.
 */
export function buildIcs(editions: CalendarEdition[], now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PowerMySport//Tournament Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tournament plan",
  ];

  for (const edition of editions) {
    const { start, endExclusive } = dayRange(edition);
    const uidSeed = edition.slug ?? `${edition.name}-${start}`.toLowerCase().replace(/\W+/g, "-");
    const location = eventLocation(edition);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidSeed}@powermysport.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${endExclusive}`,
      `SUMMARY:${escapeText(edition.name)}`,
      `DESCRIPTION:${escapeText(eventDetails(edition))}`
    );
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    if (edition.slug) lines.push(`URL:${absoluteUrl(`/tournaments/${edition.slug}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // CRLF is required by the spec, including after the last line.
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Hands the file to the browser as a download. Client-only. */
export function downloadIcs(editions: CalendarEdition[], filename = "tournament-plan.ics"): void {
  const blob = new Blob([buildIcs(editions)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
