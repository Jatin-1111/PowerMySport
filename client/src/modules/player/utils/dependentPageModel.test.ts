import { describe, expect, it } from "vitest";
import type { Dependent } from "@/types";
import { glanceFacts, nextStepFor, traitGroups } from "./dependentPageModel";

const child = (overrides: Partial<Dependent> = {}): Dependent => ({
  name: "Anuj",
  dob: "2013-03-04T00:00:00.000Z",
  ...overrides,
});

describe("nextStepFor", () => {
  it("asks for a sport first, whatever else is missing", () => {
    const step = nextStepFor(child(), false, [
      { field: "sportsFocus", label: "Sports interest" },
      { field: "location", label: "Location" },
    ]);
    expect(step?.kind).toBe("choose-sport");
    expect(step?.title).toBe("Choose a sport for Anuj");
  });

  it("names the missing parts of the profile once a sport is chosen", () => {
    const step = nextStepFor(child(), true, [
      { field: "location", label: "Location" },
      { field: "practical", label: "Goal, budget and time" },
    ]);
    expect(step?.kind).toBe("finish-profile");
    expect(step?.detail).toContain("location, goal, budget and time");
  });

  it("says nothing when nothing is outstanding", () => {
    expect(nextStepFor(child(), true, [])).toBeNull();
  });
});

describe("glanceFacts", () => {
  it("keeps every row and marks the ones not given as null", () => {
    const facts = glanceFacts(child({ location: "Punjab" }), 13);
    expect(facts.map((fact) => fact.label)).toEqual([
      "Age",
      "Relation",
      "Gender",
      "Lives in",
      "Level",
      "Time in the sport",
      "Goal",
      "Monthly budget",
      "Training time",
    ]);
    expect(facts.find((fact) => fact.label === "Lives in")?.value).toBe("Punjab");
    expect(facts.find((fact) => fact.label === "Goal")?.value).toBeNull();
  });

  it("writes the age with the birth date and words the goal and budget", () => {
    const facts = glanceFacts(
      child({ ambition: "competitive", budgetRange: "3k-7k", yearsPlaying: 1 }),
      13
    );
    expect(facts[0].value).toMatch(/^13 years, born 4 Mar 2013$/);
    expect(facts.find((fact) => fact.label === "Goal")?.value).toBe("Competitive");
    expect(facts.find((fact) => fact.label === "Monthly budget")?.value).toContain("3,000");
    expect(facts.find((fact) => fact.label === "Time in the sport")?.value).toBe("1 year");
  });
});

describe("traitGroups", () => {
  it("is empty for a child who has not taken the assessment", () => {
    expect(traitGroups(child(), 13)).toEqual([]);
  });

  it("leaves out a group with no answers and keeps the others", () => {
    const groups = traitGroups(
      child({ quiz: { energyType: "explosive", focusStyle: "sustained" } }),
      13
    );
    expect(groups.map((group) => group.title)).toEqual([
      "Body and senses",
      "Personality and play style",
    ]);
    expect(groups[0].items).toEqual(["Explosive energy"]);
  });
});
