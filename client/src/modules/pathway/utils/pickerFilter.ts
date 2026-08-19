// ─── Picker ordering, grouping and search ────────────────────────────────────
//
// The part of the sport picker that decides WHICH sports a parent is looking at.
// Pure functions in their own module, because this is the logic that has to keep
// working when the ten published pathways become fifty — and a wall of sports is
// a content problem long before it is a rendering one.
//
// Separated from the component so it can be tested at a scale the page cannot
// currently be seen at: the tests run it over dozens of synthetic sports, which
// is the only honest way to check a "works at fifty" claim while two are
// published.

import type { PathwayIndexEntry } from "../services/fetchGuide";
import { pathwaySportRank, sportGroup, sportSearchTerms } from "../data/sports";
import type { SportGroup } from "../data/sports";

export interface PickerSport {
  entry: PathwayIndexEntry;
  group: SportGroup;
  /** Lowercased name, slug words and aliases. Precomputed — search hits it per keystroke. */
  terms: string[];
}

export interface PickerFilters {
  group: SportGroup | "All";
  /** Raw input; trimmed and lowercased here so callers need not remember to. */
  query: string;
}

/**
 * Curated order, with each sport's group and search terms attached.
 *
 * The API sorts alphabetically, which is the right tiebreak and the wrong
 * headline: at fifty sports the first row decides whether the page looks like a
 * product or a directory, and it should hold the sports the site leads with.
 * `pathwaySportRank` returns a sort-last value for anything unregistered, so new
 * sports append in the API's alphabetical order rather than jumping to the top.
 */
export function indexSports(entries: PathwayIndexEntry[]): PickerSport[] {
  return entries
    .map((entry, position) => ({ entry, position }))
    .sort((a, b) => {
      const rank =
        pathwaySportRank(a.entry.sportSlug) - pathwaySportRank(b.entry.sportSlug);
      // Ties are every unregistered sport at once, so fall back to the order the
      // API gave us rather than letting sort() decide.
      return rank !== 0 ? rank : a.position - b.position;
    })
    .map(({ entry }) => ({
      entry,
      group: sportGroup(entry.sportSlug),
      terms: sportSearchTerms(entry.sportSlug, entry.sportName),
    }));
}

/** Groups that actually have a sport in them, most populated first. */
export function groupCounts(
  sports: PickerSport[],
): Array<[SportGroup, number]> {
  const counts = new Map<SportGroup, number>();
  for (const sport of sports) {
    counts.set(sport.group, (counts.get(sport.group) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * The sports to show, in order.
 *
 * Substring rather than fuzzy matching, deliberately. Fuzzy search on a list of
 * sport names mostly buys false positives — "ten" matching "Table Tennis" is
 * fine, but the character-skipping kind also matches half the list on a typo and
 * makes an empty result impossible, which is the one result that tells us a
 * parent wants a sport we have not written yet.
 */
export function filterSports(
  sports: PickerSport[],
  { group, query }: PickerFilters,
): PathwayIndexEntry[] {
  const needle = query.trim().toLowerCase();
  return sports
    .filter((sport) => group === "All" || sport.group === group)
    .filter(
      (sport) => !needle || sport.terms.some((term) => term.includes(needle)),
    )
    .map((sport) => sport.entry);
}
