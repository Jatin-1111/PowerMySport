import { dayNumber, type PlannerEdition } from "@powermysport/shared-types";

/**
 * What last year says is probably coming, for the months the calendar has not reached.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * AITA publishes about ten weeks ahead, so a "season" on the planner is eleven weeks
 * long. A parent planning a year, a school calendar around it, travel and leave, wants to
 * know what tends to happen in the months after. We hold the previous year's events, and
 * the junior circuit repeats: the same host cities run the same level around the same
 * weeks. So an event that ran 52 weeks ago, and is not on the published calendar, is
 * worth showing as EXPECTED.
 *
 * ── What it must never be mistaken for ──────────────────────────────────────
 * It is not on the calendar. It has no date, no deadline, no entry, and it can be
 * cancelled, moved or never repeated. So it is shown as "expected around March, based on
 * last year", with the month and not the day, is never offered as something to add to a
 * plan or suggested, and never counts toward anything. Day-of-week is not shown either:
 * the date a year on is a guess, and a precise-looking guess is worse than a loose one.
 *
 * Pure: the past and upcoming events are passed in, so it is tested without a database.
 */

export interface ExpectedEvent {
  /** Last year's name, which is usually this year's. */
  name: string;
  city?: string;
  state?: string;
  ladder?: string;
  /** The month it is expected, "March 2027". Never a day. */
  expectedMonth: string;
  /** The month (`YYYY-MM`) for sorting and grouping. */
  month: string;
  /** When last year's event started, `YYYY-MM-DD`, so the basis can be shown. */
  lastYearStart: string;
}

/** 52 weeks, so the day of the week is the same. */
const YEAR_ON_DAYS = 364;
/** How far beyond today to look, so "expected" stays a near-term idea. */
const LOOK_AHEAD_DAYS = 210;
/** An event on the calendar this near the anniversary is the same event, already published. */
const SAME_EVENT_WINDOW_DAYS = 45;
const MAX_EXPECTED = 12;

const MONTH_NAMES = [
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

const ageOf = (value: string): number | null => {
  const match = /(\d{1,2})/.exec(value);
  return match ? Number(match[1]) : null;
};

const normalize = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[^a-z]/g, "");

export function expectedEvents(params: {
  /** Finished events from roughly the last fourteen months. */
  past: PlannerEdition[];
  /** The published calendar, which expected events must not duplicate. */
  upcoming: PlannerEdition[];
  /** `YYYY-MM-DD`. */
  today: string;
  /** The child's age group, "U-14". Only events with a place for it are shown. */
  ageGroup: string;
}): ExpectedEvent[] {
  const today = dayNumber(params.today);
  const childAge = ageOf(params.ageGroup);
  const lastPublished = params.upcoming.reduce(
    (latest, edition) => Math.max(latest, dayNumber(edition.endDate ?? edition.startDate)),
    today
  );

  const found = new Map<string, ExpectedEvent>();
  for (const edition of params.past) {
    if (edition.kind !== "junior-ladder" || !edition.ladder) continue;
    if (childAge !== null) {
      const ages = (edition.ageGroups ?? [])
        .map(ageOf)
        .filter((age): age is number => age !== null);
      // The child's own group: an event with no place for them is not theirs to expect.
      if (!ages.includes(childAge)) continue;
    }

    const anniversary = dayNumber(edition.startDate) + YEAR_ON_DAYS;
    // Beyond what is published, and not so far off that it means nothing.
    if (anniversary <= lastPublished || anniversary > today + LOOK_AHEAD_DAYS) continue;

    const alreadyPublished = params.upcoming.some(
      (published) =>
        published.ladder === edition.ladder &&
        normalize(published.city) === normalize(edition.city) &&
        Math.abs(dayNumber(published.startDate) - anniversary) <= SAME_EVENT_WINDOW_DAYS
    );
    if (alreadyPublished) continue;

    const date = new Date(anniversary * 86_400_000);
    const month = date.toISOString().slice(0, 7);
    // One per host and level and month: the same event listed twice last year is one event.
    const key = `${edition.ladder}|${normalize(edition.city)}|${month}`;
    if (found.has(key)) continue;
    found.set(key, {
      name: edition.name,
      ...(edition.city ? { city: edition.city } : {}),
      ...(edition.state ? { state: edition.state } : {}),
      ladder: edition.ladder,
      expectedMonth: `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
      month,
      lastYearStart: edition.startDate.slice(0, 10),
    });
  }

  return [...found.values()]
    .sort((a, b) => a.month.localeCompare(b.month) || a.name.localeCompare(b.name))
    .slice(0, MAX_EXPECTED);
}
