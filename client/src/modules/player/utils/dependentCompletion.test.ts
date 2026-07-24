import { describe, expect, it } from "vitest";

import { calculateDependentCompletion, isMissingArchetypeTraits } from "./dependentCompletion";

describe("calculateDependentCompletion", () => {
  it("caps a sport-known-flow profile at 55% (sportsFocus + location + practical + standing)", () => {
    const { percent, missing } = calculateDependentCompletion({
      sportsFocus: ["Badminton"],
      location: "Maharashtra",
      budgetRange: "3k-7k",
      ambition: "competitive",
      weeklyHoursCategory: "4-7",
      currentStandingTier: 2,
      bestResultTier: 1,
    });
    expect(percent).toBe(55);
    expect(missing.map((m) => m.field)).toEqual(["physical", "personality", "comfort"]);
  });

  it("credits the assessment bucket via wizardCompletedAt without standing tiers (Discover-wizard path)", () => {
    const { missing } = calculateDependentCompletion({
      wizardCompletedAt: new Date().toISOString(),
    });
    expect(missing.map((m) => m.field)).not.toContain("assessment");
  });

  it("credits the assessment bucket via standing/best-result tiers without wizardCompletedAt (sport-known path)", () => {
    const { missing } = calculateDependentCompletion({
      currentStandingTier: 3,
      bestResultTier: 2,
    });
    expect(missing.map((m) => m.field)).not.toContain("assessment");
  });

  it("reaches 100% when every bucket is filled, regardless of which path filled it", () => {
    const { percent } = calculateDependentCompletion({
      sportsFocus: ["Badminton"],
      location: "Maharashtra",
      heightCm: 140,
      weightKg: 35,
      energyType: "explosive",
      teamIndividual: 3,
      focusStyle: "bursts",
      decisionStyle: "react",
      contactComfort: "neutral",
      environment: "outdoor",
      waterComfort: "neutral",
      budgetRange: "3k-7k",
      ambition: "competitive",
      weeklyHoursCategory: "4-7",
      currentStandingTier: 2,
      bestResultTier: 1,
    });
    expect(percent).toBe(100);
  });

  it("treats null/undefined profile as 0% with every bucket missing", () => {
    expect(calculateDependentCompletion(undefined).percent).toBe(0);
    expect(calculateDependentCompletion(null).missing).toHaveLength(7);
  });
});

describe("isMissingArchetypeTraits", () => {
  it("is true for a sport-known-flow profile that never answered trait questions", () => {
    expect(
      isMissingArchetypeTraits({
        sportsFocus: ["Badminton"],
        location: "Maharashtra",
        budgetRange: "3k-7k",
        ambition: "competitive",
        weeklyHoursCategory: "4-7",
        currentStandingTier: 2,
        bestResultTier: 1,
      }),
    ).toBe(true);
  });

  it("is false once physical/personality/comfort are all filled", () => {
    expect(
      isMissingArchetypeTraits({
        heightCm: 140,
        weightKg: 35,
        energyType: "explosive",
        teamIndividual: 3,
        focusStyle: "bursts",
        decisionStyle: "react",
        contactComfort: "neutral",
        environment: "outdoor",
        waterComfort: "neutral",
      }),
    ).toBe(false);
  });
});
