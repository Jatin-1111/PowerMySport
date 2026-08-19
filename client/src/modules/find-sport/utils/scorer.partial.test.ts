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
      (progressive as Record<string, unknown>)[key] = (
        EMPTY_ANSWERS as Record<string, unknown>
      )[key];
      const partial = { ...EMPTY_ANSWERS, ...progressive } as WizardAnswers;
      expect(() => scoreSports(partial)).not.toThrow();
      expect(() => scoreChosenSports(partial)).not.toThrow();
    }
  });
});
