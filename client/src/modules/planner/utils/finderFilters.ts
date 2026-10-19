import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import type { PlannerEdition, PlannerEntry, Shortlist } from "@powermysport/shared-types";

/**
 * The two filters on the tournament finder: where an event is, and what level it is.
 *
 * Those are what a parent plans a season around (travel, then how big a step it is), and
 * they are things every event on the federation's calendar carries, so a filter never
 * hides an event for want of data it has no way to hold. An empty string means "any".
 *
 * Pure, and applied to the list and the calendar alike so the two never disagree about
 * what is on offer. Events already on the plan are never filtered out: a decision the
 * parent has made does not vanish because of a view they chose.
 */

export interface FinderFilters {
  state: string;
  ladder: string;
}

export const NO_FILTERS: FinderFilters = { state: "", ladder: "" };

export const filtersActive = (filters: FinderFilters): boolean =>
  filters.state !== "" || filters.ladder !== "";

type Filterable = Pick<PlannerEdition, "state" | "ladder">;

export const matchesFilters = (edition: Filterable, filters: FinderFilters): boolean =>
  (filters.state === "" || edition.state === filters.state) &&
  (filters.ladder === "" || edition.ladder === filters.ladder);

const sortedUnique = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );

const ALL = (shortlist: Shortlist): PlannerEntry[] => [
  ...shortlist.ownGroup,
  ...shortlist.playingUp,
  ...shortlist.unknown,
  ...shortlist.closed,
];

/** What the selects offer: only values some event actually has. */
export function filterOptions(shortlist: Shortlist): { states: string[]; ladders: string[] } {
  const editions = ALL(shortlist).map((entry) => entry.edition);
  return {
    states: sortedUnique(editions.map((edition) => edition.state)),
    ladders: sortedUnique(editions.map((edition) => edition.ladder)),
  };
}

export function filterShortlist(shortlist: Shortlist, filters: FinderFilters): Shortlist {
  if (!filtersActive(filters)) return shortlist;
  const keep = (entries: PlannerEntry[]) =>
    entries.filter((entry) => matchesFilters(entry.edition, filters));
  return {
    ownGroup: keep(shortlist.ownGroup),
    playingUp: keep(shortlist.playingUp),
    unknown: keep(shortlist.unknown),
    closed: keep(shortlist.closed),
  };
}

export function filterItems(items: CalendarItem[], filters: FinderFilters): CalendarItem[] {
  if (!filtersActive(filters)) return items;
  return items.filter((item) => item.kind === "planned" || matchesFilters(item.edition, filters));
}
