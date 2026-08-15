import { describe, expect, it } from "vitest";

import {
  compositionLegend,
  explainTotal,
  nationalStandingPhrase,
  ownBracket,
  percentileLabel,
  plainPointLabel,
  rankAtPercentile,
  seriesClass,
  shortenPointLabel,
} from "./insights";
import type { RankingBandProfile } from "./api";

/**
 * The point-column labels are printer's shorthand off a PDF header, and they are
 * not consistent between categories — `BEST Eight SING. PTS.` on the U-12 lists,
 * `BEST-Eight SING. PTS.` on U-14, a different set again on Men's Singles. These
 * are the real strings, taken from the live snapshots.
 */
describe("shortenPointLabel", () => {
  it("reads the real AITA junior columns", () => {
    expect(shortenPointLabel("BEST Eight SING. PTS.")).toBe("Best 8 singles");
    expect(shortenPointLabel("BEST-Eight DBLS. PTS.")).toBe("Best 8 doubles");
    expect(shortenPointLabel("25% BEST Eight DBLS. PTS.")).toBe("25% best 8 doubles");
  });

  it("keeps the penalty column readable even though POINTS leads it", () => {
    // The phrase has to be matched before "POINTS" is stripped, or the rule that
    // recognises it never fires and the label comes out as bare shouting.
    expect(shortenPointLabel("POINTS CUT FOR NO SHOW LATE WL")).toBe(
      "No-show and late-withdrawal cut",
    );
  });

  it("leaves no punctuation debris behind", () => {
    // Removing "PTS." from "singles. PTS." used to leave "singles. ." on screen.
    for (const raw of [
      "BEST Eight SING. PTS.",
      "TTL. PTS. Final",
      "ITF QLY PTS",
      "Asian U-14 25% PTS.",
    ]) {
      const label = shortenPointLabel(raw);
      expect(label).not.toMatch(/\s\.|\.\s*$|\s{2}/);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("keeps governing-body acronyms capitalised", () => {
    expect(shortenPointLabel("ITF QLY PTS")).toBe("ITF qualifying");
    expect(shortenPointLabel("ATP PTS")).toBe("ATP");
  });

  it("handles the open-age vocabulary, which is a different column set entirely", () => {
    // Real Men's Singles columns. The lists carry a date inside the label, which
    // is the source's own doing and must survive intact.
    expect(shortenPointLabel("BEST Eight PTS.")).toBe("Best 8");
    expect(shortenPointLabel("27-Jul-25 ATP PTS.")).toBe("27-Jul-25 ATP");
    expect(shortenPointLabel("27-Jul-25 ITF WTT MEN PTS. X 1")).toBe(
      "27-Jul-25 ITF WTT men x 1",
    );
  });

  it("leaves age brackets and dates exactly as printed", () => {
    // Real Boys U-14 column. Case-folding "U-14" to "u-14" reads as a typo, and
    // the source detaches the percent sign from its number.
    expect(shortenPointLabel("27-Jul-25 25 % PTS. Asian U-14")).toBe(
      "27-Jul-25 25% Asian U-14",
    );
  });

  it("falls back to the raw label rather than returning nothing", () => {
    // A column labelled only with noise words would otherwise render as blank.
    expect(shortenPointLabel("PTS.")).toBe("PTS.");
  });
});

/**
 * The parent-facing layer on top of `shortenPointLabel`. These are the real
 * column strings from the live Boys U-16 and Men's Singles snapshots.
 */
describe("plainPointLabel", () => {
  it("gives the counting doubles column the plain name", () => {
    // `explainTotal` drops the raw doubles column from the stack, so the 25%
    // column is the only doubles slice a reader ever sees and does not need a
    // qualifier hung off it — the panel carries one footnote instead.
    expect(plainPointLabel("25% BEST Eight DBLS. PTS.")).toBe("Doubles");
    // The raw column still has to be nameable wherever it does surface, and its
    // name has to say why its number is not in the total.
    expect(plainPointLabel("BEST Eight DBLS. PTS.")).toBe(
      "Doubles played (not counted)",
    );
  });

  it("spells out the bracket in the derived roll-down label", () => {
    // "Playing up in U-18" is the internal label; "U-18" beside plain English
    // reads as jargon.
    expect(plainPointLabel("Playing up in U-18")).toBe("Playing up in Under-18");
  });

  it("drops the source's own file date from the international column", () => {
    // "03-Aug-25" is the list stamping itself, not a fact about the tournament.
    expect(plainPointLabel("03-Aug-25 25 % PTS. Asian U-16")).toBe(
      "Asian U-16 (international)",
    );
  });

  it("says what the penalty column is in words a parent uses", () => {
    expect(plainPointLabel("POINTS CUT FOR NO SHOW LATE WL")).toBe(
      "Penalty for pulling out",
    );
  });

  it("marks the open-age and pro-tour columns as what they are", () => {
    expect(plainPointLabel("PTS. UNDER MENS")).toBe("Played in the open-age list");
    expect(plainPointLabel("27-Jul-25 ATP PTS.")).toBe("ATP (pro tour)");
    expect(plainPointLabel("ITF QLY PTS")).toBe("ITF qualifying (international)");
  });

  it("drops the federation's multiplier notation and expands WTT", () => {
    // Real Men's Singles column. "X 1" is a weighting the sheet applies to
    // itself; a reader cannot act on it, and "WTT" is not expandable on sight.
    expect(plainPointLabel("27-Jul-25 ITF WTT MEN PTS. X 1")).toBe(
      "ITF World Tennis Tour (international)",
    );
  });

  it("names the open-age domestic column instead of leaving it as 'Best 8'", () => {
    // It sits beside three columns that each name their circuit; "Best 8" says
    // nothing about which tournaments it counts.
    expect(plainPointLabel("BEST Eight PTS.")).toBe("AITA tournaments");
  });
});

/**
 * The printed columns do not add up to the printed total. These are the real
 * figures for the live Boys U-16 list on 3 Aug 2026, checked against the API.
 */
describe("explainTotal", () => {
  const u16 = (singles: number, doubles: number, quarter: number, cut: number, asian: number) => [
    { label: "BEST Eight SING. PTS.", average: singles, isDeduction: false },
    { label: "BEST Eight DBLS. PTS.", average: doubles, isDeduction: false },
    { label: "25% BEST Eight DBLS. PTS.", average: quarter, isDeduction: false },
    { label: "POINTS CUT FOR NO SHOW LATE WL", average: cut, isDeduction: true },
    { label: "03-Aug-25 25 % PTS. Asian U-16", average: asian, isDeduction: false },
  ];

  it("recovers the points rolled down from the age group above", () => {
    // Vikrant Khandelwal: 46 singles + 2.5 doubles = 48.5, but the sheet prints
    // 78.75. The missing 30.25 is exactly his Under-18 total.
    const result = explainTotal(u16(46, 10, 2.5, 0, 0), 78.75, "U-16");
    expect(result).not.toBeNull();
    expect(result!.slices).toEqual([
      { label: "BEST Eight SING. PTS.", value: 46 },
      { label: "25% BEST Eight DBLS. PTS.", value: 2.5 },
      { label: "Playing up in U-18", value: 30.25 },
    ]);
  });

  it("leaves the raw doubles column out of the stack", () => {
    // The sheet prints both the doubles total and the quarter of it that counts.
    // Stacking both would double-count and overshoot the total.
    const result = explainTotal(u16(46, 10, 2.5, 0, 0), 78.75, "U-16");
    expect(result!.slices.map((s) => s.label)).not.toContain("BEST Eight DBLS. PTS.");
  });

  it("makes the slices add up to the total, which is the chart's whole promise", () => {
    // Tavish Pahwa, the U-16 number one: 1,291 points against 250 of printed
    // columns. 1,041 of it comes down from Under-18.
    const result = explainTotal(u16(200, 200, 50, 0, 0), 1291, "U-16");
    const sum = result!.slices.reduce((a, s) => a + s.value, 0);
    expect(sum).toBeCloseTo(1291, 2);
    expect(result!.slices.at(-1)).toEqual({ label: "Playing up in U-18", value: 1041 });
  });

  it("adds the no-show cut back before solving for the remainder", () => {
    // Paranjay Siwach: own columns 773.75, Under-18 209.75, cut 5 → 978.5.
    const result = explainTotal(u16(220, 215, 53.75, 5, 500), 978.5, "U-16");
    expect(result!.slices.at(-1)).toEqual({ label: "Playing up in U-18", value: 209.75 });
    expect(result!.deductions).toEqual([
      { label: "POINTS CUT FOR NO SHOW LATE WL", value: 5 },
    ]);
  });

  it("adds nothing on the open-age lists, where the columns already balance", () => {
    // Sumit Nagal, Men's Singles: no bracket above, columns sum to the total.
    const result = explainTotal(
      [
        { label: "BEST Eight PTS.", average: 0, isDeduction: false },
        { label: "03-Aug-25 ATP PTS.", average: 2230, isDeduction: false },
        { label: "POINTS CUT FOR NO SHOW LATE WL", average: 0, isDeduction: true },
      ],
      2230,
      "Singles",
    );
    expect(result!.slices).toEqual([{ label: "03-Aug-25 ATP PTS.", value: 2230 }]);
  });

  it("draws nothing rather than a wrong chart when the parts overshoot", () => {
    // A negative remainder means the model no longer describes this list — a
    // column set changed, or a rule did. Returning null withholds the panel.
    expect(explainTotal(u16(900, 10, 2.5, 0, 0), 100, "U-16")).toBeNull();
  });

  it("tolerates the rounding in a band average without inventing a slice", () => {
    // Band averages arrive at one decimal, so a couple of tenths of drift across
    // four columns is arithmetic rather than a real rolled-down component.
    const result = explainTotal(u16(50, 0, 0, 0, 0), 50.2, "U-16");
    expect(result!.slices.map((s) => s.label)).not.toContain("Playing up in U-18");
  });
});

describe("ownBracket", () => {
  it("picks the youngest bracket, which is the one they cannot be visiting", () => {
    // A child may enter an older age group but never a younger one, so the
    // youngest list they appear on is their own by construction.
    expect(ownBracket(["U-18", "U-16"])).toBe("U-16");
    expect(ownBracket(["U-16", "U-18", "U-14"])).toBe("U-14");
  });

  it("never treats an open-age list as a home bracket", () => {
    // A sixteen year old on the Men's list is the clearest case of playing up
    // there is; calling it their own age group inverts the whole page.
    expect(ownBracket(["Singles", "U-18"])).toBe("U-18");
    expect(ownBracket(["Singles", "Doubles"])).toBeNull();
  });

  it("returns null for no lists at all", () => {
    expect(ownBracket([])).toBeNull();
  });
});

describe("nationalStandingPhrase", () => {
  it("says the percentile the same way the row chip does", () => {
    expect(nationalStandingPhrase(312, 1602)).toBe("in the top 20% in India");
    expect(nationalStandingPhrase(1, 1602)).toBe("in the top 1% in India");
  });

  it("stops quoting a percentile once it would read as praise for being last", () => {
    // "Top 80%" is true and insulting. Being ranked at all is the fact worth
    // naming down there.
    expect(nationalStandingPhrase(1500, 1602)).toBe(
      "ranked among the top 1,602 in India",
    );
  });

  it("withholds a phrase it cannot compute", () => {
    expect(nationalStandingPhrase(12, null)).toBeNull();
    expect(nationalStandingPhrase(12, 0)).toBeNull();
  });
});

describe("percentile helpers", () => {
  it("never says top 0%", () => {
    expect(percentileLabel(1, 1648)).toBe("Top 1%");
    expect(percentileLabel(412, 1648)).toBe("Top 25%");
    expect(percentileLabel(1648, 1648)).toBe("Top 100%");
  });

  it("withholds a percentile it cannot compute", () => {
    expect(percentileLabel(12, null)).toBeNull();
    expect(percentileLabel(12, 0)).toBeNull();
  });

  it("converts a percentile back to the rank it starts at", () => {
    expect(rankAtPercentile(10, 1648)).toBe(165);
    expect(rankAtPercentile(25, 1648)).toBe(412);
    // Never rank 0 on a tiny list.
    expect(rankAtPercentile(10, 4)).toBe(1);
  });
});

describe("composition legend", () => {
  const band = (label: string, composition: RankingBandProfile["composition"]): RankingBandProfile => ({
    label,
    from: 1,
    to: 10,
    playerCount: 10,
    averageTotal: 100,
    composition,
  });

  it("keeps one order across bands so a source keeps its colour", () => {
    // The second band is missing "Doubles" entirely. If the legend were built
    // per band, "Asian" would take the colour "Doubles" had in the first bar.
    const bands = [
      band("Top 10", [
        { label: "Singles", average: 50, isDeduction: false },
        { label: "Doubles", average: 30, isDeduction: false },
        { label: "Asian", average: 20, isDeduction: false },
      ]),
      band("Rest", [
        { label: "Singles", average: 10, isDeduction: false },
        { label: "Asian", average: 1, isDeduction: false },
      ]),
    ];

    const legend = compositionLegend(bands);
    expect(legend).toEqual(["Singles", "Doubles", "Asian"]);
    expect(seriesClass(legend.indexOf("Asian"))).toBe("bg-rank-series-3");
  });

  it("leaves deduction columns out of the legend", () => {
    const legend = compositionLegend([
      band("Top 10", [
        { label: "Singles", average: 50, isDeduction: false },
        { label: "No-show cut", average: 2, isDeduction: true },
      ]),
    ]);
    expect(legend).toEqual(["Singles"]);
  });
});
