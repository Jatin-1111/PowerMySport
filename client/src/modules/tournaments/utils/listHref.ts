import type { EditionListFilters } from "../services/editionListing";

export interface TournamentListState extends EditionListFilters {
  upcoming: boolean;
  page: number;
}

/**
 * The URL for a sport's tournament list after one change. Changing any filter
 * goes back to page 1, since the old page number means nothing in the new
 * list. Switching between upcoming and past drops the month, because the two
 * windows share no months.
 */
export function tournamentListHref(
  sportSlug: string,
  state: TournamentListState,
  change: Partial<TournamentListState> = {}
): string {
  const next = { ...state, ...change };
  if (!("page" in change)) next.page = 1;
  if ("upcoming" in change && change.upcoming !== state.upcoming) next.month = undefined;

  const qs = new URLSearchParams();
  if (!next.upcoming) qs.set("when", "past");
  if (next.category) qs.set("category", next.category);
  if (next.age) qs.set("age", next.age);
  if (next.month) qs.set("month", next.month);
  if (next.page > 1) qs.set("page", String(next.page));

  const query = qs.toString();
  return `/tournaments/sport/${sportSlug}${query ? `?${query}` : ""}`;
}
