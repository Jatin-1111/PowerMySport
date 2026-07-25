import { describe, expect, it } from "vitest";

import {
  ARCHETYPE_META,
  ARCHETYPE_SKELETONS,
  getArchetypeForSport,
  groupLevelsIntoMacro,
  resolveArchetypeCopy,
  stageIndexForRawLevel,
} from "./macroLevels";
import { getSportArchetypeInfo, type Archetype } from "./sportArchetypes";

// Minimal PathwayLevel stub — grouping only reads `level`.
const level = (n: number) =>
  ({ level: n, label: `L${n}`, title: "", description: "", keyFocus: "", ageRange: "", competitions: "", steps: [] }) as any;

const FIVE_LEVELS = [1, 2, 3, 4, 5].map(level);
const ARCHETYPES: Archetype[] = ["federation", "ranking", "rating", "standard"];

describe("ARCHETYPE_SKELETONS", () => {
  it("every skeleton covers raw levels 1–5 exactly once, in ascending order", () => {
    for (const archetype of ARCHETYPES) {
      const covered = ARCHETYPE_SKELETONS[archetype].flatMap(
        (s) => s.rawLevelNumbers,
      );
      expect(covered, archetype).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("federation keeps the original 3 stages; the rest have 4", () => {
    expect(ARCHETYPE_SKELETONS.federation).toHaveLength(3);
    expect(ARCHETYPE_SKELETONS.ranking).toHaveLength(4);
    expect(ARCHETYPE_SKELETONS.rating).toHaveLength(4);
    expect(ARCHETYPE_SKELETONS.standard).toHaveLength(4);
  });

  it("stage ids are unique across all archetypes", () => {
    const ids = ARCHETYPES.flatMap((a) =>
      ARCHETYPE_SKELETONS[a].map((s) => s.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every stage carries the copy and palette the skeleton UIs render", () => {
    for (const archetype of ARCHETYPES) {
      for (const stage of ARCHETYPE_SKELETONS[archetype]) {
        expect(stage.funnelNote.length, `${archetype}/${stage.id}`).toBeGreaterThan(20);
        expect(stage.exitValueNote.length, `${archetype}/${stage.id}`).toBeGreaterThan(20);
        expect(stage.durationNote.length, `${archetype}/${stage.id}`).toBeGreaterThan(3);
        expect(stage.stepper.hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("groupLevelsIntoMacro", () => {
  it("defaults to the federation skeleton (backward compatible)", () => {
    const macros = groupLevelsIntoMacro(FIVE_LEVELS);
    expect(macros.map((m) => m.id)).toEqual([
      "beginner",
      "intermediate",
      "competitive",
    ]);
    expect(macros[1].rawLevels.map((l) => l.level)).toEqual([2, 3]);
  });

  it("groups per archetype skeleton", () => {
    const ranking = groupLevelsIntoMacro(FIVE_LEVELS, "ranking");
    expect(ranking.map((m) => m.rawLevels.map((l) => l.level))).toEqual([
      [1],
      [2],
      [3, 4],
      [5],
    ]);

    const rating = groupLevelsIntoMacro(FIVE_LEVELS, "rating");
    expect(rating.map((m) => m.rawLevels.map((l) => l.level))).toEqual([
      [1],
      [2],
      [3],
      [4, 5],
    ]);

    const standard = groupLevelsIntoMacro(FIVE_LEVELS, "standard");
    expect(standard.map((m) => m.rawLevels.map((l) => l.level))).toEqual([
      [1],
      [2],
      [3],
      [4, 5],
    ]);
  });

  it("uses a merged stage's leading edge as representative", () => {
    const ranking = groupLevelsIntoMacro(FIVE_LEVELS, "ranking");
    expect(ranking[2].representativeRawLevel).toBe(4);
    expect(ranking[2].representativeLabel).toBe("L4");
  });

  it("drops stages whose raw levels are missing (partial generation)", () => {
    const macros = groupLevelsIntoMacro([1, 2].map(level), "ranking");
    expect(macros.map((m) => m.id)).toEqual(["foundation", "state-circuit"]);
  });
});

describe("stageIndexForRawLevel", () => {
  it("locates the stage containing a raw level per archetype", () => {
    // experienceLevel mapping: beginner→1, intermediate→3, competitive→4
    expect(stageIndexForRawLevel("federation", 3)).toBe(1);
    expect(stageIndexForRawLevel("federation", 4)).toBe(2);
    expect(stageIndexForRawLevel("ranking", 3)).toBe(2);
    expect(stageIndexForRawLevel("rating", 3)).toBe(2);
    expect(stageIndexForRawLevel("rating", 4)).toBe(3);
    expect(stageIndexForRawLevel("standard", 5)).toBe(3);
  });

  it("falls back to 0 for out-of-range levels", () => {
    expect(stageIndexForRawLevel("ranking", 99)).toBe(0);
  });
});

describe("archetype resolution", () => {
  it("resolves names and slugs alike", () => {
    expect(getSportArchetypeInfo("Table Tennis").archetype).toBe("ranking");
    expect(getSportArchetypeInfo("table-tennis").archetype).toBe("ranking");
    expect(getSportArchetypeInfo("CHESS").archetype).toBe("rating");
    expect(getSportArchetypeInfo("swimming").unit).toBe("time");
    expect(getSportArchetypeInfo("shooting").unit).toBe("score");
  });

  it("defaults unknown sports (and empty input) to federation", () => {
    expect(getSportArchetypeInfo("kho kho").archetype).toBe("federation");
    expect(getSportArchetypeInfo("").archetype).toBe("federation");
  });

  it("getArchetypeForSport bundles meta", () => {
    const { archetype, unit, meta } = getArchetypeForSport("Athletics");
    expect(archetype).toBe("standard");
    expect(unit).toBe("time");
    expect(meta).toBe(ARCHETYPE_META.standard);
  });
});

describe("resolveArchetypeCopy", () => {
  it("substitutes the qualifying unit", () => {
    expect(
      resolveArchetypeCopy("beat the {unit} standard", "time"),
    ).toBe("beat the time standard");
    expect(resolveArchetypeCopy("beat the {unit} standard")).toBe(
      "beat the time or score standard",
    );
  });
});
