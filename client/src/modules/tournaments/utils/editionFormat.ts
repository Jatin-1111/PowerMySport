import { CAL_TZ } from "@/modules/pathway/config/tournamentDisplay";

/**
 * "Venue, City", without repeating a city the venue already names and without
 * a placeholder venue like "TBC". Lives here, not beside the federation page,
 * so module code can use it; editionUtils.ts re-exports it for its importers.
 */
export function formatLocation(venue?: string, city?: string): string | null {
  const v = venue?.trim();
  const c = city?.trim();
  if (!v) return c || null;
  if (!c) return v;
  if (/^(tbc|tba|to be (confirmed|announced))$/i.test(v)) return c;
  const vl = v.toLowerCase();
  const cl = c.toLowerCase();
  if (vl === cl || vl.includes(cl) || cl.includes(vl)) return v.length >= c.length ? v : c;
  return `${v}, ${c}`;
}

const dayMonth: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: CAL_TZ };

/** "28 Sept 2026", or "28 Sept – 3 Oct 2026" when the event runs over several days. */
export function formatEditionDates(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate);
  const withYear = (d: Date) => d.toLocaleDateString("en-IN", { ...dayMonth, year: "numeric" });
  if (!endDate) return withYear(start);

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return withYear(start);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const from = sameYear ? start.toLocaleDateString("en-IN", dayMonth) : withYear(start);
  return `${from} – ${withYear(end)}`;
}
