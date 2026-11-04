import { describe, expect, it } from "vitest";
import { judgeReach, reachLabel, type AcceptanceSample } from "@powermysport/shared-types";

/**
 * What these pin: that "would they have got in" is read off what actually happened at past
 * events, that a draw nobody was turned away from is not called cut, and that with too
 * little evidence it says so and does not guess.
 */

const sample = (over: Partial<AcceptanceSample> = {}): AcceptanceSample => ({
  externalId: "1",
  startDate: "2026-09-21",
  ladder: "National Series",
  ageGroup: "U-16",
  gender: "Boys",
  mainDrawSize: 64,
  mainDirectSlots: 55,
  // A full main draw: 55 ranked players, the worst of them rank 120.
  mainRanks: Array.from({ length: 55 }, (_, i) => 2 + i * 2 + 8),
  mainUnranked: 0,
  qualifyingSize: 48,
  qualifyingDirectSlots: 44,
  // A full qualifying: 44 ranked players, the worst of them rank 480.
  qualifyingRanks: Array.from({ length: 44 }, (_, i) => 130 + i * 8),
  qualifyingUnranked: 0,
  ...over,
});

const events = (count: number, over: Partial<AcceptanceSample> = {}) =>
  Array.from({ length: count }, (_, i) =>
    sample({ externalId: String(i), startDate: `2026-0${9 - i}-15`, ...over })
  );

const LABEL = reachLabel("National Series", "Boys", "U-16");

describe("judging whether a rank would have got in", () => {
  it("calls a rank inside the main draw likely", () => {
    const verdict = judgeReach(events(3), 40, LABEL);
    expect(verdict.kind).toBe("likely");
    expect(verdict.mainDraw).toBe(3);
  });

  it("calls a rank between the two cut-offs a qualifying rank", () => {
    // Main draw closed at 118, qualifying at 474.
    const verdict = judgeReach(events(3), 312, LABEL);
    expect(verdict.kind).toBe("qualifying");
    expect(verdict.qualifying).toBe(3);
    expect(verdict.text).toMatch(/qualifying/);
  });

  it("calls a rank outside both unlikely", () => {
    const verdict = judgeReach(events(3), 900, LABEL);
    expect(verdict.kind).toBe("unlikely");
    expect(verdict.mainDraw).toBe(0);
  });

  it("says where the main draw closed, as a middle figure, and names the kind of event", () => {
    const verdict = judgeReach(events(3), 900, LABEL);
    expect(verdict.mainCutoffs).toHaveLength(3);
    expect(verdict.text).toContain("closed around rank 118");
    expect(verdict.text).toContain("Boys U-16 National Series");
    expect(verdict.text).toMatch(/not this one/);
  });

  it("does not call a draw cut when nobody was turned away", () => {
    // 18 of 55 direct places taken: everyone who entered got in, whatever their rank.
    const quiet = events(3, { mainRanks: [43, 88, 272], mainUnranked: 15 });
    const verdict = judgeReach(quiet, 900, LABEL);
    expect(verdict.kind).toBe("likely");
    expect(verdict.mainCutoffs).toEqual([]);
    expect(verdict.text).toMatch(/Every player who entered got a place/);
  });

  it("lets an unranked child in only where unranked players were admitted to a full draw", () => {
    const admitted = events(3, {
      mainUnranked: 5,
      mainRanks: Array.from({ length: 50 }, (_, i) => i + 1),
    });
    expect(judgeReach(admitted, null, LABEL).kind).toBe("likely");

    const closed = events(3);
    // Full of ranked players, and its qualifying too: an unranked child was never admitted.
    expect(judgeReach(closed, null, LABEL).kind).toBe("unlikely");
  });

  it("reads a majority of events, not a single one", () => {
    const mixed = [
      ...events(2),
      sample({ externalId: "quiet", startDate: "2026-06-01", mainRanks: [10], mainUnranked: 0 }),
    ];
    // Rank 312 was outside the main draw twice and inside once (it was not full): qualifying.
    expect(judgeReach(mixed, 312, LABEL).kind).not.toBe("likely");
  });

  it("reads only the newest events, because an old season is a different season", () => {
    const old = events(5, {
      startDate: "2024-01-01",
      mainRanks: [1, 2, 3, 4, 5],
      mainUnranked: 50,
    });
    const recent = events(5, { startDate: "2026-09-01" });
    const verdict = judgeReach([...old, ...recent], 900, LABEL);
    expect(verdict.events).toBe(5);
    expect(verdict.kind).toBe("unlikely");
  });
});

describe("having too little to go on", () => {
  it("says there is no evidence with no past events, and says so in words", () => {
    const verdict = judgeReach([], 312, LABEL);
    expect(verdict.kind).toBe("no-evidence");
    expect(verdict.text).toMatch(/hold no past Boys U-16 National Series/);
  });

  it("will not judge from one event", () => {
    const verdict = judgeReach(events(1), 312, LABEL);
    expect(verdict.kind).toBe("no-evidence");
    expect(verdict.text).toMatch(/only one/);
  });

  it("judges from two", () => {
    expect(judgeReach(events(2), 40, LABEL).kind).toBe("likely");
  });
});
