/**
 * Converting a wall-clock time in a named timezone to a true instant.
 *
 * Extracted from ExpertAvailabilityService, which had the only correct
 * implementation, so that recurring coach schedules do not get a second,
 * slightly different copy of the same arithmetic. Both now share this one.
 *
 * India (Asia/Kolkata, the default everywhere in this codebase) has no DST so
 * its offset is stable, but the Intl-based lookup keeps other zones correct —
 * which matters for anything that stores a repeating weekly pattern, because a
 * pattern stored as wall-clock time cannot be reinterpreted later without
 * rewriting history.
 */

export const MS_PER_MIN = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a Date, read in UTC. */
export const toDateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Parse "YYYY-MM-DD" into a [year, month, day] tuple (no undefined). */
export const parseDateKey = (dateKey: string): [number, number, number] => {
  const p = dateKey.split("-").map(Number);
  return [p[0] ?? 1970, p[1] ?? 1, p[2] ?? 1];
};

/** Parse "HH:mm" into minutes from midnight. */
export const parseHHmm = (v: string): number => {
  const parts = v.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

/** Minutes that `tz` is ahead of UTC at the given instant. */
export const tzOffsetMinutes = (tz: string, at: Date): number => {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === "24" ? "0" : parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - at.getTime()) / MS_PER_MIN);
  } catch {
    return 0; // treat an unknown zone as UTC rather than throwing
  }
};

/** Convert a local "YYYY-MM-DD" + minutes-from-midnight in `tz` to a UTC Date. */
export const zonedToUtc = (dateKey: string, minutesFromMidnight: number, tz: string): Date => {
  const [y, m, d] = parseDateKey(dateKey);
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(tz, new Date(utcGuess));
  return new Date(utcGuess - offset * MS_PER_MIN);
};

/** Weekday (0=Sun..6=Sat) of a calendar date, timezone-independent. */
export const weekdayOfDateKey = (dateKey: string): number => {
  const [y, m, d] = parseDateKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** "YYYY-MM-DD" shifted by whole days. */
export const addDaysKey = (dateKey: string, days: number): string => {
  const [y, m, d] = parseDateKey(dateKey);
  return toDateKey(new Date(Date.UTC(y, m - 1, d + days)));
};
