import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/modules/guidance/config/wizard/guidanceUtils";
import { profileSuggestions } from "./profileSuggestions";

const form = (over: Partial<typeof EMPTY_FORM> = {}) => ({ ...EMPTY_FORM, ...over });

describe("profileSuggestions", () => {
  it("offers nothing when the answers are the pre-filled values", () => {
    const child = {
      gender: "FEMALE",
      location: "Delhi",
      experienceLevel: "beginner",
      weeklyHoursCategory: "4-7",
      budgetRange: "3k-7k",
    };
    const answers = form({
      gender: "FEMALE",
      state: "Delhi",
      experienceLevel: "beginner",
      weeklyHours: "4-7",
      budgetRange: "3k-7k",
    });

    expect(profileSuggestions(child, answers)).toEqual([]);
  });

  it("offers only the answers that differ, in words", () => {
    const child = { weeklyHoursCategory: "4-7", budgetRange: "3k-7k", location: "Delhi" };
    const answers = form({ weeklyHours: "8-12", budgetRange: "3k-7k", state: "Delhi" });

    expect(profileSuggestions(child, answers)).toEqual([
      {
        field: "weeklyHoursCategory",
        label: "Training time",
        current: "4 to 7 hours a week",
        next: "8 to 12 hours a week",
        value: "8-12",
      },
    ]);
  });

  it("offers a value the profile has no answer for, with no 'current'", () => {
    const [suggestion] = profileSuggestions({}, form({ experienceLevel: "intermediate" }));

    expect(suggestion).toMatchObject({
      field: "experienceLevel",
      current: null,
      next: "Intermediate",
      value: "intermediate",
    });
  });

  it("ignores a question left unanswered, so it never clears a stored value", () => {
    expect(profileSuggestions({ budgetRange: "3k-7k" }, form())).toEqual([]);
  });

  it("never offers the sport: a plan for a sport does not say the child plays it", () => {
    const fields = profileSuggestions({}, form({ sport: "Tennis" })).map((s) => s.field);

    expect(fields).not.toContain("sportsFocus");
  });

  it("never overwrites a child recorded as OTHER, which the question cannot express", () => {
    expect(profileSuggestions({ gender: "OTHER" }, form({ gender: "MALE" }))).toEqual([]);
  });

  it("offers nothing when no child was selected", () => {
    expect(profileSuggestions(null, form({ weeklyHours: "8-12" }))).toEqual([]);
    expect(profileSuggestions(undefined, form({ weeklyHours: "8-12" }))).toEqual([]);
  });
});
