import { describe, expect, it } from "vitest";

import { annualEntryCap, entryStatus, isJuniorBracket } from "./aitaRules";

/**
 * These are the only facts on either ranking page that are not derived from the
 * lists we mirror, which makes them the only ones a code change can get wrong
 * without any data disagreeing. Pinned here for that reason.
 *
 * Source: AITA Junior Tournament Structure, 2020 — top 150 of an age group are
 * barred from Talent Series, top 75 from Championship Series.
 */
describe("entryStatus", () => {
  it("closes both lower levels inside the top 75", () => {
    const status = entryStatus(40, "U-16");
    expect(status?.closed).toEqual(["Talent Series", "Championship Series"]);
    // Nothing stricter left to warn about.
    expect(status?.nextGate).toBeNull();
  });

  it("closes only Talent Series between 76 and 150", () => {
    const status = entryStatus(120, "U-16");
    expect(status?.closed).toEqual(["Talent Series"]);
    expect(status?.nextGate).toEqual({ rank: 75, level: "Championship Series" });
  });

  it("treats the cut-offs as inclusive, the way a rank list reads", () => {
    // Rank 75 is *inside* the top 75, and rank 151 is outside the top 150.
    expect(entryStatus(75, "U-16")?.closed).toHaveLength(2);
    expect(entryStatus(76, "U-16")?.closed).toEqual(["Talent Series"]);
    expect(entryStatus(150, "U-16")?.closed).toEqual(["Talent Series"]);
    expect(entryStatus(151, "U-16")?.closed).toEqual([]);
  });

  it("reports no bars below the gates, and names the next one", () => {
    const status = entryStatus(312, "U-16");
    expect(status?.closed).toEqual([]);
    expect(status?.nextGate).toEqual({ rank: 150, level: "Talent Series" });
  });

  it("says nothing at all about the open-age lists", () => {
    // The reverse gates are a junior-circuit rule. Applying them to Men's Singles
    // would be inventing a regulation.
    expect(entryStatus(40, "Singles")).toBeNull();
    expect(entryStatus(40, "Doubles")).toBeNull();
  });

  it("refuses a rank that is not one", () => {
    expect(entryStatus(0, "U-16")).toBeNull();
    expect(entryStatus(Number.NaN, "U-16")).toBeNull();
  });
});

describe("annualEntryCap", () => {
  it("carries the real per-bracket allowances", () => {
    expect(annualEntryCap("U-12")).toBe(18);
    expect(annualEntryCap("U-14")).toBe(25);
    expect(annualEntryCap("U-16")).toBe(30);
  });

  it("has none for U-18, which is uncapped, or for open age", () => {
    // Returning a number here would put a limit on screen that does not exist.
    expect(annualEntryCap("U-18")).toBeNull();
    expect(annualEntryCap("Singles")).toBeNull();
  });
});

describe("isJuniorBracket", () => {
  it("matches only the age brackets", () => {
    expect(isJuniorBracket("U-16")).toBe(true);
    expect(isJuniorBracket("u-12")).toBe(true);
    expect(isJuniorBracket("Singles")).toBe(false);
    expect(isJuniorBracket("Doubles")).toBe(false);
  });
});
