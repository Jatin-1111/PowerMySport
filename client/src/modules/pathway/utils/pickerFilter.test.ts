import { describe, expect, it } from "vitest";

import type { PathwayIndexEntry } from "../services/fetchGuide";
import { filterSports, groupCounts, indexSports } from "./pickerFilter";
import { PATHWAY_SPORTS } from "../data/sports";

// ─── The picker at fifty sports ──────────────────────────────────────────────
//
// Two pathways are published, so the page cannot be looked at under the load it
// is designed for. These tests are how that claim is checked: they build a
// catalogue several times larger than today's and assert that the controls still
// narrow it to something a parent can read.

const entry = (slug: string, name: string): PathwayIndexEntry => ({
  sportSlug: slug,
  sportName: name,
  stageCount: 6,
  stages: [],
});

/** The ten registered sports plus forty-four the registry has never heard of. */
const manySports = (): PathwayIndexEntry[] => {
  const registered = PATHWAY_SPORTS.map((sport) => entry(sport.slug, sport.name));
  const unregistered = Array.from({ length: 44 }, (_, i) =>
    // Alphabetical, the order the API returns.
    entry(`sport-${String(i).padStart(2, "0")}`, `Sport ${i}`)
  );
  return [...registered, ...unregistered];
};

describe("indexSports", () => {
  it("leads with the curated sports and keeps the rest in API order", () => {
    // Deliberately shuffled: the API sorts alphabetically, so "Basketball"
    // arrives before "Tennis" and the curated order has to reassert itself.
    const shuffled = [...manySports()].reverse();
    const ordered = indexSports(shuffled).map((s) => s.entry.sportSlug);

    expect(ordered.slice(0, 3)).toEqual(["tennis", "cricket", "chess"]);
    expect(ordered).toHaveLength(54);

    // Unregistered sports keep the order they came in, rather than being
    // re-sorted by a tie-break that does not exist.
    const unregistered = ordered.filter((slug) => slug.startsWith("sport-"));
    expect(unregistered[0]).toBe("sport-43");
    expect(unregistered.at(-1)).toBe("sport-00");
  });

  it("files an unknown sport under Other rather than dropping it", () => {
    const indexed = indexSports([entry("kabaddi", "Kabaddi")]);
    expect(indexed).toHaveLength(1);
    expect(indexed[0]?.group).toBe("Other");
  });
});

describe("groupCounts", () => {
  it("counts only groups that have sports, most populated first", () => {
    const counts = groupCounts(indexSports(manySports()));
    const asObject = Object.fromEntries(counts);

    // 44 unregistered sports dwarf every real group, so Other leads.
    expect(counts[0]?.[0]).toBe("Other");
    expect(asObject.Racquet).toBe(3); // tennis, badminton, table tennis
    expect(asObject.Team).toBe(5);
    expect(asObject.Mind).toBe(1);
    // Nothing combat-shaped is published, so the filter never offers it.
    expect(asObject.Combat).toBeUndefined();
  });
});

describe("filterSports", () => {
  const sports = indexSports(manySports());
  const slugs = (query: string, group: "All" | "Racquet" | "Team" = "All") =>
    filterSports(sports, { group, query }).map((e) => e.sportSlug);

  it("shows everything when nothing is asked of it", () => {
    expect(slugs("")).toHaveLength(54);
    expect(slugs("   ")).toHaveLength(54);
  });

  it("narrows fifty-four sports to a handful on a two-letter query", () => {
    // The point of the whole control: a parent types, the wall becomes a list.
    expect(slugs("te").length).toBeLessThan(10);
    expect(slugs("te")).toContain("tennis");
    expect(slugs("te")).toContain("table-tennis");
  });

  it("matches what parents actually type, not just the official name", () => {
    expect(slugs("soccer")).toEqual(["football"]);
    expect(slugs("ping pong")).toEqual(["table-tennis"]);
    expect(slugs("shuttle")).toEqual(["badminton"]);
  });

  it("matches the slug's words, so a hyphen is not a dead end", () => {
    expect(slugs("table tennis")).toEqual(["table-tennis"]);
  });

  it("is case and whitespace insensitive", () => {
    expect(slugs("  TENNIS ")).toEqual(slugs("tennis"));
  });

  it("combines the group filter with the search", () => {
    expect(slugs("", "Racquet")).toEqual(["tennis", "badminton", "table-tennis"]);
    // "ball" hits basketball, football and volleyball — but not in Racquet.
    expect(slugs("ball", "Team")).toEqual(["football", "basketball", "volleyball"]);
    expect(slugs("ball", "Racquet")).toEqual([]);
  });

  it("returns nothing for a sport we have not written, rather than a near miss", () => {
    // An empty result is the signal the page acts on: it is the clearest
    // evidence a parent knows what they want and we do not have it.
    expect(slugs("kabaddi")).toEqual([]);
  });

  it("keeps curated order inside a filtered result", () => {
    // Filtering must not reshuffle: Tennis outranks Badminton in the registry,
    // so it outranks it in every result that contains both.
    const matches = slugs("n");
    expect(matches).toContain("tennis");
    expect(matches).toContain("badminton");
    expect(matches.indexOf("tennis")).toBeLessThan(matches.indexOf("badminton"));
  });
});
