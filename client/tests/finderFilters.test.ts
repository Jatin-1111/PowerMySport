import { describe, expect, it } from "vitest";
import { buildShortlist } from "@powermysport/shared-types";

import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import {
  filterItems,
  filterOptions,
  filterShortlist,
  filtersActive,
  matchesFilters,
  NO_FILTERS,
} from "@/modules/planner/utils/finderFilters";

/**
 * The finder's filters decide what a parent is shown, so what is pinned is the ways they
 * go wrong: hiding an event for want of data, hiding something already on the plan, and
 * the list and the calendar disagreeing about what matches.
 */

const edition = (slug: string, start: string, over: Record<string, unknown> = {}) => ({
  slug,
  name: `Event ${slug}`,
  startDate: `${start}T00:00:00.000Z`,
  endDate: `${start}T00:00:00.000Z`,
  city: "Town",
  state: "Haryana",
  ageGroups: ["Under-14"],
  ladder: "Championship Series",
  grade: 7,
  kind: "junior-ladder",
  ...over,
});

const shortlist = buildShortlist(
  [
    edition("a", "2026-11-02"),
    edition("b", "2026-11-03", { state: "Delhi" }),
    edition("c", "2026-11-04", { state: "Delhi", ladder: "Talent Series" }),
    edition("d", "2026-11-05", { state: undefined }),
  ],
  { bracket: "U-14", rank: 312 }
);

const item = (slug: string, kind: CalendarItem["kind"], state: string): CalendarItem => ({
  slug,
  name: slug,
  startDate: "2026-11-02T00:00:00.000Z",
  kind,
  edition: { slug, name: slug, startDate: "2026-11-02T00:00:00.000Z", state },
  clashes: [],
  hasOverlap: false,
});

describe("matching", () => {
  it("treats an empty filter as any, and matches state and level together", () => {
    expect(filtersActive(NO_FILTERS)).toBe(false);
    expect(filtersActive({ state: "Delhi", ladder: "" })).toBe(true);
    const e = { state: "Delhi", ladder: "Talent Series" };
    expect(matchesFilters(e, NO_FILTERS)).toBe(true);
    expect(matchesFilters(e, { state: "Delhi", ladder: "" })).toBe(true);
    expect(matchesFilters(e, { state: "Delhi", ladder: "Talent Series" })).toBe(true);
    expect(matchesFilters(e, { state: "Delhi", ladder: "Super Series" })).toBe(false);
    expect(matchesFilters(e, { state: "Haryana", ladder: "" })).toBe(false);
  });
});

describe("options", () => {
  it("offers only what some event has, sorted, and nothing for an event with no state", () => {
    expect(filterOptions(shortlist)).toEqual({
      states: ["Delhi", "Haryana"],
      ladders: ["Championship Series", "Talent Series"],
    });
  });
});

describe("filtering the list", () => {
  const slugs = (entries: Array<{ edition: { slug?: string | undefined } }>) =>
    entries.map((entry) => entry.edition.slug);

  it("is the same list when nothing is chosen", () => {
    expect(filterShortlist(shortlist, NO_FILTERS)).toBe(shortlist);
  });

  it("keeps only the events in the chosen state", () => {
    const result = filterShortlist(shortlist, { state: "Delhi", ladder: "" });
    expect(slugs(result.ownGroup)).toEqual(["b", "c"]);
  });

  it("combines state and level", () => {
    const result = filterShortlist(shortlist, { state: "Delhi", ladder: "Talent Series" });
    expect(slugs(result.ownGroup)).toEqual(["c"]);
  });
});

describe("filtering the calendar", () => {
  it("narrows suggestions and open events, but never an event on the plan", () => {
    const items = [
      item("planned-haryana", "planned", "Haryana"),
      item("open-delhi", "available", "Delhi"),
      item("open-haryana", "available", "Haryana"),
      item("suggested-haryana", "suggested", "Haryana"),
    ];
    const result = filterItems(items, { state: "Delhi", ladder: "" });
    expect(result.map((entry) => entry.slug)).toEqual(["planned-haryana", "open-delhi"]);
  });
});
