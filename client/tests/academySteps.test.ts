import { describe, expect, it } from "vitest";
import {
  ACADEMY_STEPS,
  LAST_ACADEMY_STEP,
  SAVEABLE_ACADEMY_STEPS,
  academyProgressPercent,
  academyStepTitle,
  isAcademyStepNumber,
  resumeStepFor,
} from "@/modules/onboarding/utils/academySteps";

describe("academy steps", () => {
  it("are numbered 1 to 7, the way the server numbers them", () => {
    expect(ACADEMY_STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ACADEMY_STEPS.map((s) => s.key)).toEqual([
      "basic",
      "location",
      "legal",
      "venues",
      "coaches",
      "pricing",
      "payouts",
    ]);
    expect(LAST_ACADEMY_STEP).toBe(7);
  });

  it("save through the step route from step 2, because step 1 is start", () => {
    expect(SAVEABLE_ACADEMY_STEPS).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("recognise valid step numbers only", () => {
    expect(isAcademyStepNumber(1)).toBe(true);
    expect(isAcademyStepNumber(7)).toBe(true);
    expect(isAcademyStepNumber(0)).toBe(false);
    expect(isAcademyStepNumber(8)).toBe(false);
    expect(isAcademyStepNumber(2.5)).toBe(false);
  });

  it("give each step a title", () => {
    expect(academyStepTitle(4)).toBe("Venues");
    expect(academyStepTitle(7)).toBe("Payouts and terms");
    expect(academyStepTitle(99)).toBe("");
  });
});

describe("resume", () => {
  it("continues on the step after the last one saved", () => {
    expect(resumeStepFor(1)).toBe(2);
    expect(resumeStepFor(3)).toBe(4);
    expect(resumeStepFor(6)).toBe(7);
  });

  it("never goes past the last step", () => {
    expect(resumeStepFor(7)).toBe(7);
    expect(resumeStepFor(12)).toBe(7);
  });

  it("starts at step 1 for a missing or nonsensical value", () => {
    expect(resumeStepFor(undefined)).toBe(1);
    expect(resumeStepFor(null)).toBe(1);
    expect(resumeStepFor(0)).toBe(1);
    expect(resumeStepFor(-3)).toBe(1);
    expect(resumeStepFor(Number.NaN)).toBe(1);
  });
});

describe("progress", () => {
  it("is steps saved out of seven", () => {
    expect(academyProgressPercent(undefined)).toBe(0);
    expect(academyProgressPercent(0)).toBe(0);
    expect(academyProgressPercent(1)).toBe(14);
    expect(academyProgressPercent(7)).toBe(100);
    expect(academyProgressPercent(20)).toBe(100);
  });
});
