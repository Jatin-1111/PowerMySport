import { describe, expect, it } from "vitest";

import {
  calculateDependentCompletion,
  hasAssessment,
  isMissingArchetypeTraits,
} from "./dependentCompletion";

const COMPLETE = {
  sportsFocus: ["Badminton"],
  location: "Maharashtra",
  budgetRange: "3k-7k",
  ambition: "competitive",
  weeklyHoursCategory: "4-7",
  currentStandingTier: 2,
};

describe("calculateDependentCompletion", () => {
  it("reaches 100% without any quiz answer", () => {
    const { percent, missing } = calculateDependentCompletion(COMPLETE);
    expect(percent).toBe(100);
    expect(missing).toEqual([]);
  });

  it("credits the sport bucket from chosenSport alone — the assessment records a commitment, not an interest", () => {
    // The state the dashboard once got wrong: assessment finished, badminton
    // picked on the results page, `sportsFocus` never written. The card showed
    // the sport, then asked the parent to "Add their sport".
    const { missing } = calculateDependentCompletion({
      ...COMPLETE,
      sportsFocus: undefined,
      chosenSport: "Badminton",
    });
    expect(missing.map((m) => m.field)).not.toContain("sportsFocus");
  });

  it("still reports the sport bucket missing when neither field is set", () => {
    const { missing } = calculateDependentCompletion({ location: "Chandigarh" });
    expect(missing.map((m) => m.field)).toContain("sportsFocus");
  });

  it("credits the level bucket from the experience level the edit form sets", () => {
    const { missing } = calculateDependentCompletion({
      ...COMPLETE,
      currentStandingTier: undefined,
      experienceLevel: "beginner",
    });
    expect(missing.map((m) => m.field)).not.toContain("standing");
  });

  it("credits the level bucket from the standing tier alone", () => {
    const { missing } = calculateDependentCompletion({ currentStandingTier: 3 });
    expect(missing.map((m) => m.field)).not.toContain("standing");
  });

  it("needs all three of goal, budget and time for the practical bucket", () => {
    const { missing } = calculateDependentCompletion({
      ...COMPLETE,
      weeklyHoursCategory: undefined,
    });
    expect(missing.map((m) => m.field)).toEqual(["practical"]);
  });

  it("treats null/undefined profile as 0% with every bucket missing", () => {
    expect(calculateDependentCompletion(undefined).percent).toBe(0);
    expect(calculateDependentCompletion(null).missing).toHaveLength(4);
  });
});

describe("hasAssessment", () => {
  it("is true once the quiz is completed or a standing tier is recorded", () => {
    expect(hasAssessment({ wizardCompletedAt: new Date().toISOString() })).toBe(true);
    expect(hasAssessment({ currentStandingTier: 1 })).toBe(true);
  });

  it("is false for a profile with neither", () => {
    expect(hasAssessment({ sportsFocus: ["Tennis"] })).toBe(false);
    expect(hasAssessment(undefined)).toBe(false);
  });
});

describe("isMissingArchetypeTraits", () => {
  it("is true for a profile that never answered the quiz", () => {
    expect(isMissingArchetypeTraits(COMPLETE)).toBe(true);
  });

  it("is false once physical/personality/comfort are all filled", () => {
    expect(
      isMissingArchetypeTraits({
        quiz: {
          heightCm: 140,
          weightKg: 35,
          energyType: "explosive",
          teamIndividual: 3,
          focusStyle: "bursts",
          decisionStyle: "react",
          contactComfort: "neutral",
          environment: "outdoor",
          waterComfort: "neutral",
        },
      })
    ).toBe(false);
  });
});
