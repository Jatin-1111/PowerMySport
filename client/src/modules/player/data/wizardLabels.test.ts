import {
  CHILD_AMBITIONS,
  CHILD_BUDGET_RANGES,
  CHILD_GENDERS,
  CHILD_WEEKLY_HOURS,
} from "@powermysport/shared-types";
import { describe, expect, it } from "vitest";

import {
  AMBITION_LABELS,
  BUDGET_RANGE_LABELS,
  GENDER_LABELS,
  WEEKLY_HOURS_LABELS,
  wizardChip,
} from "./wizardLabels";

// The profile shows these as chips. A value the vocabulary allows but a label map forgot shows
// as no chip at all: "career", the top goal on offer, was missing from the ambition labels, so
// those children's goal never appeared on their profile.
describe("the profile's labels cover the shared vocabulary", () => {
  const cases: Array<[string, readonly string[], Record<string, string>]> = [
    ["gender", CHILD_GENDERS, GENDER_LABELS],
    ["ambition", CHILD_AMBITIONS, AMBITION_LABELS],
    ["budget range", CHILD_BUDGET_RANGES, BUDGET_RANGE_LABELS],
    ["weekly hours", CHILD_WEEKLY_HOURS, WEEKLY_HOURS_LABELS],
  ];

  for (const [name, values, labels] of cases) {
    it(`has a label for every ${name} value`, () => {
      for (const value of values) {
        expect(wizardChip(value, labels), `${name}: ${value}`).toBeTruthy();
      }
    });
  }

  it("shows a child whose goal is a career", () => {
    expect(wizardChip("career", AMBITION_LABELS)).toBe("Career in sport");
  });
});
