import { describe, expect, it } from "vitest";

import {
  ENTRY_BANDS,
  RULES_SOURCE,
  annualEntryCap,
  entryStatus,
  isJuniorBracket,
} from "./aitaRules";

/**
 * These are the only facts on either ranking page that are not derived from the
 * lists we mirror, which makes them the only ones a code change can get wrong
 * without any data disagreeing. Pinned here for that reason.
 *
 * Source: AITA Junior Tournament Structure, effective 1 January 2026. Quoting
 * the two rules that matter here, because both were wrong in this file until the
 * 2026 document was read:
 *
 *   · "TOP 75 AITA-ranked players in their respective age groups will NOT be
 *     permitted to take part in TS tournaments in that age group."
 *   · "There will be no restriction in Championship Series. All ranked players
 *     can play irrespective of their rank."
 *
 * The previous version barred the top 150 from Talent Series and the top 75 from
 * Championship Series. Neither is the rule.
 */
describe("entryStatus", () => {
  it("closes Talent Series inside the top 75, and nothing else", () => {
    const status = entryStatus(40, "U-16");
    expect(status?.closed).toEqual(["Talent Series"]);
    // Championship Series has no rank bar, so there is no second gate.
    expect(status?.nextGate).toBeNull();
  });

  it("does not bar Championship Series at any rank", () => {
    // The regression that matters: a top-75 player used to be told Championship
    // Series was shut to them, which would send a parent to the wrong tournament.
    for (const rank of [1, 40, 75, 76, 150, 151, 900]) {
      expect(entryStatus(rank, "U-16")?.closed).not.toContain("Championship Series");
    }
  });

  it("treats the cut-off as inclusive, the way a rank list reads", () => {
    // Rank 75 is *inside* the top 75; 76 is not.
    expect(entryStatus(75, "U-16")?.closed).toEqual(["Talent Series"]);
    expect(entryStatus(76, "U-16")?.closed).toEqual([]);
  });

  it("reports no bars below the gate, and names it as what is coming", () => {
    const status = entryStatus(312, "U-16");
    expect(status?.closed).toEqual([]);
    expect(status?.nextGate).toEqual({ rank: 75, level: "Talent Series" });
  });

  it("never claims Talent Series closed at U-18, which has none", () => {
    // 2026: "There will be no Talent Series tournaments for the Under 18 age
    // group." Telling a top-75 U-18 that it just closed would describe the loss
    // of something that was never available.
    const top = entryStatus(10, "U-18");
    expect(top?.closed).toEqual([]);
    expect(top?.nextGate).toBeNull();
    expect(entryStatus(900, "U-18")?.nextGate).toBeNull();
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

describe("the stated bands and citation", () => {
  it("describes the same two bands the gate logic implements", () => {
    // The table and the per-player answer are read side by side on the same page,
    // so a band that disagrees with `entryStatus` is a visible contradiction.
    expect(ENTRY_BANDS).toHaveLength(2);
    expect(ENTRY_BANDS[0]!.range).toContain("75");
    expect(ENTRY_BANDS.some((b) => /Championship Series closed/i.test(b.effect))).toBe(false);
  });

  it("cites the document it was actually written against", () => {
    // A rule set with no automatic check needs a date on it — that is the whole
    // reason the 2020 numbers survived into 2026 unnoticed.
    expect(RULES_SOURCE.label).toContain("2026");
    expect(RULES_SOURCE.href).toMatch(/^https:\/\/www\.aita\.hitcourt\.com\//);
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
