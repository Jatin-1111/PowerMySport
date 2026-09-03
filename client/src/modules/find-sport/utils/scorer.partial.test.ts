import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, type WizardAnswers } from "../types";
import { scoreChosenSports, scoreSports } from "./scorer";

/**
 * WizardShell now derives its scores from `answers` on every change
 * (`useMemo`), instead of computing them once inside the processing effect.
 * That means the scorer runs on PARTIAL answers throughout the questionnaire,
 * not just on the complete set at the end. These tests pin the invariant the
 * refactor depends on: scoring must be total over partial input — never throw,
 * never NaN — since a throw in a `useMemo` would crash the wizard render.
 */

describe("scorer tolerates partial answers (WizardShell derive-scores refactor)", () => {
  it("does not throw on fully empty answers", () => {
    expect(() => scoreSports(EMPTY_ANSWERS)).not.toThrow();
    expect(() => scoreChosenSports(EMPTY_ANSWERS)).not.toThrow();
  });

  it("returns arrays with finite scores on empty answers", () => {
    for (const r of scoreSports(EMPTY_ANSWERS)) {
      expect(Number.isFinite(r.score)).toBe(true);
    }
    for (const r of scoreChosenSports(EMPTY_ANSWERS)) {
      expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it("does not throw as answers are filled in one field at a time", () => {
    // Simulate the questionnaire: start empty and add each field progressively.
    const progressive: Partial<WizardAnswers> = {};
    const keys = Object.keys(EMPTY_ANSWERS) as (keyof WizardAnswers)[];
    for (const key of keys) {
      (progressive as Record<string, unknown>)[key] = (EMPTY_ANSWERS as Record<string, unknown>)[
        key
      ];
      const partial = { ...EMPTY_ANSWERS, ...progressive } as WizardAnswers;
      expect(() => scoreSports(partial)).not.toThrow();
      expect(() => scoreChosenSports(partial)).not.toThrow();
    }
  });
});

/**
 * `career` was added as a distinct ambition value rather than by relabelling
 * `professional`, so its scoring treatment is a decision that has to be pinned
 * rather than inherited. It sits at the top of the ladder: same elite gates and
 * same late-start penalty as national/professional ambition.
 */
describe("`career` ambition scores as an elite tier", () => {
  const withAmbition = (ambition: WizardAnswers["ambition"]): WizardAnswers => ({
    ...EMPTY_ANSWERS,
    ambition,
    age: 9,
    state: "Maharashtra",
  });

  it("does not throw or produce NaN", () => {
    expect(() => scoreSports(withAmbition("career"))).not.toThrow();
    for (const r of scoreSports(withAmbition("career"))) {
      expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it("scores identically to the legacy `professional` value it replaced", () => {
    const career = scoreSports(withAmbition("career"));
    const professional = scoreSports(withAmbition("professional"));
    expect(career.map((r) => [r.sport.name, r.score])).toEqual(
      professional.map((r) => [r.sport.name, r.score])
    );
  });

  it("is treated as elite, not as casual — a late start is penalised the way it is for `national`, not the way it is for `fun`", () => {
    // Age 17 is past the starting window for several sports; the elite tiers
    // take a much steeper penalty there than "fun" does.
    const late = (a: WizardAnswers["ambition"]) => ({ ...withAmbition(a), age: 17 });
    const total = (a: WizardAnswers["ambition"]) =>
      scoreSports(late(a)).reduce((sum, r) => sum + r.score, 0);

    expect(total("career")).toBeLessThan(total("fun"));
  });
});
