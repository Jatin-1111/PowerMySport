/**
 * How an event's dates read on the page.
 *
 * Formatted in UTC because the stored value is midnight UTC of the calendar date
 * the federation printed. Local formatting would be right in India by luck and
 * a day early for anyone west of Greenwich.
 */

const SHORT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const formatShortDate = (iso: string): string => SHORT.format(new Date(iso));
export const formatLongDate = (iso: string): string => LONG.format(new Date(iso));

/** "5 Oct to 10 Oct", or "5 Oct" for a one-day event or a missing end date. */
export function formatEventWindow(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  if (!end || end.getTime() <= start.getTime()) return SHORT.format(start);
  return `${SHORT.format(start)} to ${SHORT.format(end)}`;
}

/** "23:59" becomes "11:59 pm". Anything that is not a 24-hour time comes back unchanged. */
export function formatClockTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23) return time;
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${suffix}`;
}
