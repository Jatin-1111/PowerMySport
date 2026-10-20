import { CAL_TZ } from "@/modules/pathway/config/tournamentDisplay";

const PLACEHOLDER_PLACE = /^(tbc|tba|tbd|to be (confirmed|announced|decided))$/i;

/**
 * "Venue, City", without repeating a city the venue already names and without
 * a placeholder venue like "TBC". Lives here, not beside the federation page,
 * so module code can use it; editionUtils.ts re-exports it for its importers.
 */
export function formatLocation(venue?: string, city?: string): string | null {
  // Checked before the empty-city shortcut: a "TBC" venue with no city used to
  // come back as the location itself ("starts 20 Oct 2026 at TBC").
  const v = venue?.trim() && !PLACEHOLDER_PLACE.test(venue.trim()) ? venue.trim() : undefined;
  const c = city?.trim() && !PLACEHOLDER_PLACE.test(city.trim()) ? city.trim() : undefined;
  if (!v) return c || null;
  if (!c) return v;
  const vl = v.toLowerCase();
  const cl = c.toLowerCase();
  if (vl === cl || vl.includes(cl) || cl.includes(vl)) return v.length >= c.length ? v : c;
  return `${v}, ${c}`;
}

/**
 * Meta description for an event that is over. "Starts 11 Aug" would read as an
 * event you can still enter, so say it is over and name what comes next.
 */
export function finishedEditionSnippet(input: {
  title: string;
  startLabel: string;
  where: string | null;
  nextLabel?: string | undefined;
  sportSlug: string;
  city?: string | undefined;
}): string {
  return [
    `${input.title} took place on ${input.startLabel}`,
    input.where ? `at ${input.where}.` : null,
    input.nextLabel
      ? `The next edition is ${input.nextLabel}.`
      : `See upcoming ${input.sportSlug} tournaments${input.city ? ` in ${input.city}` : ""}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Meta description for an event that has not happened yet. Two events with the
 * same date and city otherwise get near-identical snippets; the organiser and
 * the entry deadline are what tell them apart.
 */
export function upcomingEditionSnippet(input: {
  title: string;
  startLabel: string;
  where: string | null;
  ageGroups?: string[] | undefined;
  organiser?: string | undefined;
  entriesCloseLabel?: string | undefined;
}): string {
  const lead = [
    `${input.title} starts ${input.startLabel}`,
    input.where ? `at ${input.where}` : null,
    input.ageGroups?.length ? `for ${input.ageGroups.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return [
    `${lead}.`,
    input.organiser ? `Organised by ${input.organiser}.` : null,
    input.entriesCloseLabel ? `Entries close ${input.entriesCloseLabel}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Picks the finished or upcoming snippet; `fmt` formats a date for display. */
export function editionSnippet(
  input: {
    edition: {
      startDate: string;
      sportSlug: string;
      city?: string | undefined;
      ageGroups?: string[] | undefined;
      organiser?: string | undefined;
      registrationDeadlineDate?: string | undefined;
    };
    title: string;
    where: string | null;
    finished: boolean;
    nextStartDate?: string | undefined;
  },
  fmt: (date: string) => string,
  now: Date = new Date()
): string {
  const { edition, title, where } = input;
  if (input.finished) {
    return finishedEditionSnippet({
      title,
      startLabel: fmt(edition.startDate),
      where,
      nextLabel: input.nextStartDate ? fmt(input.nextStartDate) : undefined,
      sportSlug: edition.sportSlug,
      city: edition.city,
    });
  }
  return upcomingEditionSnippet({
    title,
    startLabel: fmt(edition.startDate),
    where,
    ageGroups: edition.ageGroups,
    organiser: edition.organiser,
    // A deadline that has already passed is not a reason to click; leave it out.
    entriesCloseLabel:
      edition.registrationDeadlineDate && !hasDatePassed(edition.registrationDeadlineDate, now)
        ? fmt(edition.registrationDeadlineDate)
        : undefined,
  });
}

/** Dates are stored as UTC midnight, so a date is still "today" until that day ends. */
function hasDatePassed(date: string, now: Date): boolean {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
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
