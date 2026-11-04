import { describe, expect, it } from "vitest";
import type { HandoffChild } from "../services/handoffApi";
import { buildClaim, dobBounds, dobProblem, initialDrafts } from "./review";

const NOW = new Date("2026-10-22T10:00:00Z");

const vikrant: HandoffChild = {
  key: "vikrant",
  firstName: "Vikrant",
  ageText: "14",
  sports: ["Tennis"],
  suggestedAmbition: "competitive",
  suggestedExperience: "intermediate",
};
const riya: HandoffChild = { key: "riya", firstName: "Riya", sports: ["Swimming"] };

describe("dobBounds", () => {
  it("allows today and the day after turning 18 a year back, nothing outside", () => {
    expect(dobBounds(NOW)).toEqual({ min: "2008-10-23", max: "2026-10-22" });
  });
});

describe("dobProblem", () => {
  it("asks for a date when there is none", () => {
    expect(dobProblem("", NOW)).toBe("Enter a date of birth.");
  });

  it("refuses text that is not a date", () => {
    expect(dobProblem("01/12/2012", NOW)).toBe("Enter a valid date of birth.");
    expect(dobProblem("2012-13-45", NOW)).toBe("Enter a valid date of birth.");
  });

  it("refuses a date in the future", () => {
    expect(dobProblem("2026-10-23", NOW)).toBe("A date of birth cannot be in the future.");
  });

  it("refuses someone who is 18 or older, and accepts one day short of it", () => {
    expect(dobProblem("2008-10-22", NOW)).toBe("A child must be under 18.");
    expect(dobProblem("2008-10-23", NOW)).toBeNull();
  });

  it("accepts an ordinary child's date of birth, and a newborn's", () => {
    expect(dobProblem("2012-12-01", NOW)).toBeNull();
    expect(dobProblem("2026-10-22", NOW)).toBeNull();
  });
});

describe("initialDrafts", () => {
  it("selects every child and pre-chooses only the suggestions that exist", () => {
    expect(initialDrafts([vikrant, riya])).toEqual({
      vikrant: { include: true, dob: "", ambition: "competitive", experience: "intermediate" },
      riya: { include: true, dob: "" },
    });
  });
});

describe("buildClaim", () => {
  it("builds the request for the ticked children with their dates of birth and choices", () => {
    const drafts = {
      vikrant: {
        include: true,
        dob: "2012-12-01",
        gender: "MALE" as const,
        ambition: "competitive" as const,
        experience: "intermediate" as const,
      },
      riya: { include: false, dob: "" },
    };
    expect(buildClaim([vikrant, riya], drafts, NOW)).toEqual({
      ok: true,
      items: [
        {
          key: "vikrant",
          dob: "2012-12-01",
          gender: "MALE",
          ambition: "competitive",
          experienceLevel: "intermediate",
        },
      ],
    });
  });

  it("leaves out a choice the parent cleared, so nothing is saved that they did not confirm", () => {
    const result = buildClaim(
      [vikrant],
      { vikrant: { include: true, dob: "2012-12-01", ambition: undefined } },
      NOW
    );
    expect(result).toEqual({ ok: true, items: [{ key: "vikrant", dob: "2012-12-01" }] });
  });

  it("says what to fix per child, and does not skip the others' checks", () => {
    const result = buildClaim(
      [vikrant, riya],
      { vikrant: { include: true, dob: "" }, riya: { include: true, dob: "2000-01-01" } },
      NOW
    );
    expect(result).toEqual({
      ok: false,
      errors: { vikrant: "Enter a date of birth.", riya: "A child must be under 18." },
    });
  });

  it("does not check a child the parent unticked", () => {
    const result = buildClaim(
      [vikrant, riya],
      { vikrant: { include: true, dob: "2012-12-01" }, riya: { include: false, dob: "" } },
      NOW
    );
    expect(result.ok).toBe(true);
  });

  it("asks for at least one child when none is ticked", () => {
    const result = buildClaim([vikrant], { vikrant: { include: false, dob: "" } }, NOW);
    expect(result).toEqual({ ok: false, errors: { _: "Choose at least one child." } });
  });
});
