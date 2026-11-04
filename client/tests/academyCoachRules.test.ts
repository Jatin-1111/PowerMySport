import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  coachesForSave,
  coachesFromSaved,
  createEmptyCoach,
  isBlankCoach,
  validateCoaches,
} from "@/modules/onboarding/utils/academyCoachRules";
import type { AcademyCoachInput } from "@/modules/onboarding/types/academy";

const coach = (over: Partial<AcademyCoachInput> = {}): AcademyCoachInput => ({
  firstName: "Asha",
  lastName: "Rao",
  email: "asha@example.com",
  sports: ["Tennis"],
  ...over,
});

describe("blank rows", () => {
  it("recognises a row nobody filled in", () => {
    expect(isBlankCoach(createEmptyCoach())).toBe(true);
    expect(isBlankCoach({ ...createEmptyCoach(), firstName: "  " })).toBe(true);
  });
  it("does not call a half-filled row blank", () => {
    expect(isBlankCoach({ ...createEmptyCoach(), email: "a@b.co" })).toBe(false);
    expect(isBlankCoach({ ...createEmptyCoach(), sports: ["Tennis"] })).toBe(false);
  });
});

describe("validateCoaches", () => {
  it("passes complete coaches, and an empty list", () => {
    expect(validateCoaches([coach()])).toEqual({});
    expect(validateCoaches([])).toEqual({});
  });

  it("names every missing field on a half-filled row", () => {
    const errors = validateCoaches([{ ...createEmptyCoach(), firstName: "Asha" }]);
    expect(errors[0]).toEqual({
      lastName: "Enter a last name",
      email: "Enter a valid email",
      sports: "Choose at least one sport",
    });
  });

  it("refuses short and over-long names", () => {
    expect(validateCoaches([coach({ firstName: "A" })])[0]?.firstName).toBeTruthy();
    expect(
      validateCoaches([coach({ lastName: "x".repeat(MAX_NAME_LENGTH + 1) })])[0]?.lastName
    ).toBe("That name is too long");
    expect(validateCoaches([coach({ lastName: "x".repeat(MAX_NAME_LENGTH) })])).toEqual({});
  });

  it("refuses malformed emails", () => {
    for (const email of ["nope", "a@b", "a b@c.com", "@c.com", ""]) {
      expect(validateCoaches([coach({ email })])[0]?.email).toBeTruthy();
    }
  });

  it("flags the same email used twice, ignoring case and spaces, on the later row", () => {
    const errors = validateCoaches([
      coach({ email: "Asha@Example.com" }),
      coach({ firstName: "Bina", email: "  asha@example.COM " }),
    ]);
    expect(errors[0]).toBeUndefined();
    expect(errors[1]?.email).toBe("This email is already in the list");
  });

  it("treats plus-addressed emails as different people", () => {
    expect(
      validateCoaches([coach({ email: "a@example.com" }), coach({ email: "a+x@example.com" })])
    ).toEqual({});
  });

  it("reports errors by row", () => {
    const errors = validateCoaches([coach(), coach({ email: "bad" }), coach({ sports: [] })]);
    expect(Object.keys(errors)).toEqual(["1", "2"]);
  });
});

describe("coachesForSave", () => {
  it("drops blank rows, trims text and lowercases the email", () => {
    expect(
      coachesForSave([
        createEmptyCoach(),
        coach({ firstName: "  Asha ", email: "  Asha@Example.COM " }),
        createEmptyCoach(),
      ])
    ).toEqual([
      { firstName: "Asha", lastName: "Rao", email: "asha@example.com", sports: ["Tennis"] },
    ]);
  });

  it("gives an empty list when nothing was filled in", () => {
    expect(coachesForSave([createEmptyCoach()])).toEqual([]);
  });
});

describe("coachesFromSaved", () => {
  it("keeps only the four fields from older, fuller records", () => {
    expect(
      coachesFromSaved([
        {
          firstName: "Asha",
          lastName: "Rao",
          email: "asha@example.com",
          sports: ["Tennis"],
          phone: "+919876543210",
          bio: "A bio",
          hourlyRate: 900,
        },
      ])
    ).toEqual([
      { firstName: "Asha", lastName: "Rao", email: "asha@example.com", sports: ["Tennis"] },
    ]);
  });

  it("copes with missing and malformed data", () => {
    expect(coachesFromSaved(undefined)).toEqual([]);
    expect(coachesFromSaved("nope")).toEqual([]);
    expect(coachesFromSaved([null, {}])).toEqual([
      { firstName: "", lastName: "", email: "", sports: [] },
      { firstName: "", lastName: "", email: "", sports: [] },
    ]);
  });
});
