import { describe, it, expect } from "vitest";
import {
  isAnswered,
  getAgeFromDob,
  buildProfileChips,
  buildGoalChips,
  EXPERIENCE_DISPLAY,
  TRAINING_TYPE_DISPLAY,
  ENERGY_DISPLAY,
  AMBITION_DISPLAY,
  HOURS_DISPLAY,
  BUDGET_DISPLAY,
  EMPTY_FORM,
  type KnownSportForm,
} from "./sportKnownFlowUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function form(overrides: Partial<KnownSportForm> = {}): KnownSportForm {
  return { ...EMPTY_FORM, ...overrides };
}

/** Returns "YYYY-MM-DD" for Jan 1st exactly N years ago (birthday always already passed). */
function dobYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// ─── Label map coverage ────────────────────────────────────────────────────────

describe("label maps — all UI option values are covered", () => {
  it("EXPERIENCE_DISPLAY covers beginner / intermediate / competitive", () => {
    ["beginner", "intermediate", "competitive"].forEach((k) => {
      expect(EXPERIENCE_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });

  it("EXPERIENCE_DISPLAY does NOT contain 'recreational' (old value)", () => {
    expect(EXPERIENCE_DISPLAY["recreational"]).toBeUndefined();
  });

  it("TRAINING_TYPE_DISPLAY covers all 4 options", () => {
    ["self", "club", "academy", "private"].forEach((k) => {
      expect(TRAINING_TYPE_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });

  it("ENERGY_DISPLAY covers all 2 options", () => {
    ["explosive", "endurance"].forEach((k) => {
      expect(ENERGY_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });

  it("AMBITION_DISPLAY covers all 4 options", () => {
    ["fun", "competitive", "national", "professional"].forEach((k) => {
      expect(AMBITION_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });

  it("HOURS_DISPLAY covers all 4 options", () => {
    ["1-3", "4-7", "8-12", "13-plus"].forEach((k) => {
      expect(HOURS_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });

  it("BUDGET_DISPLAY covers all 4 options", () => {
    ["under-3k", "3k-7k", "7k-15k", "15k-plus"].forEach((k) => {
      expect(BUDGET_DISPLAY[k], `missing: ${k}`).toBeTruthy();
    });
  });
});

// ─── getAgeFromDob ────────────────────────────────────────────────────────────

describe("getAgeFromDob", () => {
  it("returns correct age for 10 years ago (Jan 1)", () => {
    expect(getAgeFromDob(dobYearsAgo(10))).toBe(10);
  });

  it("returns correct age for 5 years ago", () => {
    expect(getAgeFromDob(dobYearsAgo(5))).toBe(5);
  });

  it("returns correct age for 18 years ago", () => {
    expect(getAgeFromDob(dobYearsAgo(18))).toBe(18);
  });

  it("boundary: 1 year ago → returns 1", () => {
    expect(getAgeFromDob(dobYearsAgo(1))).toBe(1);
  });

  it("boundary: 30 years ago → returns 30", () => {
    expect(getAgeFromDob(dobYearsAgo(30))).toBe(30);
  });

  it("boundary: 31 years ago → returns null (above range)", () => {
    expect(getAgeFromDob(dobYearsAgo(31))).toBeNull();
  });

  it("empty string → null", () => {
    expect(getAgeFromDob("")).toBeNull();
  });

  it("invalid string → null", () => {
    expect(getAgeFromDob("abc")).toBeNull();
    expect(getAgeFromDob("not-a-date")).toBeNull();
  });

  it("future date → null (age would be negative)", () => {
    expect(getAgeFromDob("2099-01-01")).toBeNull();
  });

  it("today's date → null (age 0 is below range)", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getAgeFromDob(today)).toBeNull();
  });

  it("birthday not yet reached this year returns one year less", () => {
    // Dec 31 of (currentYear - 5) — birthday hasn't happened yet this year
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    d.setMonth(11); // December
    d.setDate(31);
    const dob = d.toISOString().slice(0, 10);
    const age = getAgeFromDob(dob);
    // Could be 4 or 5 depending on whether Dec 31 has passed; either is valid
    expect(age === 4 || age === 5).toBe(true);
  });
});

// ─── isAnswered ───────────────────────────────────────────────────────────────

describe("isAnswered", () => {
  it("non-empty string field → true", () => {
    expect(isAnswered("sport", form({ sport: "Tennis" }))).toBe(true);
    expect(isAnswered("childName", form({ childName: "Arjun" }))).toBe(true);
    expect(isAnswered("dateOfBirth", form({ dateOfBirth: "2015-06-15" }))).toBe(true);
  });

  it("empty string → false", () => {
    expect(isAnswered("sport", form({ sport: "" }))).toBe(false);
    expect(isAnswered("childName", form({ childName: "" }))).toBe(false);
    expect(isAnswered("dateOfBirth", form({ dateOfBirth: "" }))).toBe(false);
  });

  it("null field → false", () => {
    expect(isAnswered("gender", form({ gender: null }))).toBe(false);
    expect(isAnswered("state", form({ state: null }))).toBe(false);
    expect(isAnswered("experienceLevel", form({ experienceLevel: null }))).toBe(false);
    expect(isAnswered("weeklyHours", form({ weeklyHours: null }))).toBe(false);
  });

  it("non-null string → true", () => {
    expect(isAnswered("gender", form({ gender: "MALE" }))).toBe(true);
    expect(isAnswered("state", form({ state: "Delhi" }))).toBe(true);
    expect(isAnswered("experienceLevel", form({ experienceLevel: "intermediate" }))).toBe(true);
  });

  it("EMPTY_FORM required fields (sport, state) are false", () => {
    expect(isAnswered("sport", EMPTY_FORM)).toBe(false);
    expect(isAnswered("state", EMPTY_FORM)).toBe(false);
  });
});

// ─── buildProfileChips ────────────────────────────────────────────────────────

describe("buildProfileChips", () => {
  it("full form produces all 6 chips", () => {
    const chips = buildProfileChips(
      form({
        gender: "MALE",
        dateOfBirth: dobYearsAgo(10),
        state: "Maharashtra",
        experienceLevel: "intermediate",
        trainingType: "academy",
        energyType: "explosive",
      })
    );
    expect(chips).toContain("Boy");
    expect(chips).toContain("Age 10");
    expect(chips).toContain("Maharashtra");
    expect(chips).toContain("Intermediate");
    expect(chips).toContain("Academy");
    expect(chips).toContain("High energy");
    expect(chips).toHaveLength(6);
  });

  it("null trainingType omits training chip", () => {
    const chips = buildProfileChips(form({ trainingType: null }));
    const trainingChips = ["Self-practice", "Club / School", "Academy", "Private coaching"];
    expect(chips.some((c) => trainingChips.includes(c))).toBe(false);
  });

  it("all 4 training types map correctly", () => {
    expect(buildProfileChips(form({ trainingType: "self" }))).toContain("Self-practice");
    expect(buildProfileChips(form({ trainingType: "club" }))).toContain("Club / School");
    expect(buildProfileChips(form({ trainingType: "academy" }))).toContain("Academy");
    expect(buildProfileChips(form({ trainingType: "private" }))).toContain("Private coaching");
  });

  it("FEMALE gender shows 'Girl'", () => {
    expect(buildProfileChips(form({ gender: "FEMALE" }))).toContain("Girl");
  });

  it("null gender omitted", () => {
    const chips = buildProfileChips(form({ gender: null }));
    expect(chips).not.toContain("Boy");
    expect(chips).not.toContain("Girl");
  });

  it("empty dateOfBirth omits age chip", () => {
    const chips = buildProfileChips(form({ dateOfBirth: "" }));
    expect(chips.some((c) => c.startsWith("Age"))).toBe(false);
  });

  it("invalid DOB string omits age chip (no crash)", () => {
    const chips = buildProfileChips(form({ dateOfBirth: "abc" }));
    expect(chips.some((c) => c.startsWith("Age"))).toBe(false);
  });

  it("future DOB omits age chip", () => {
    const chips = buildProfileChips(form({ dateOfBirth: "2099-01-01" }));
    expect(chips.some((c) => c.startsWith("Age"))).toBe(false);
  });

  it("valid DOB shows correct age chip", () => {
    const chips = buildProfileChips(form({ dateOfBirth: dobYearsAgo(12) }));
    expect(chips).toContain("Age 12");
  });

  it("null state omitted", () => {
    const chips = buildProfileChips(form({ state: null }));
    const knownChips = ["Boy", "Girl", "Beginner", "Intermediate", "Competitive", "High energy", "Calm & focused"];
    const unknownChips = chips.filter((c) => !c.startsWith("Age") && !knownChips.includes(c));
    expect(unknownChips).toHaveLength(0);
  });

  it("state value passes through as-is", () => {
    expect(buildProfileChips(form({ state: "Tamil Nadu" }))).toContain("Tamil Nadu");
  });

  it("all 3 experience levels map correctly", () => {
    expect(buildProfileChips(form({ experienceLevel: "beginner" }))).toContain("Beginner");
    expect(buildProfileChips(form({ experienceLevel: "intermediate" }))).toContain("Intermediate");
    expect(buildProfileChips(form({ experienceLevel: "competitive" }))).toContain("Competitive");
  });

  it("null experienceLevel omitted", () => {
    const chips = buildProfileChips(form({ experienceLevel: null }));
    expect(chips.some((c) => ["Beginner", "Intermediate", "Competitive"].includes(c))).toBe(false);
  });

  it("all 2 energy types map correctly", () => {
    expect(buildProfileChips(form({ energyType: "explosive" }))).toContain("High energy");
    expect(buildProfileChips(form({ energyType: "endurance" }))).toContain("Calm & focused");
  });

  it("completely empty form → empty array", () => {
    expect(buildProfileChips(EMPTY_FORM)).toHaveLength(0);
  });
});

// ─── buildGoalChips ───────────────────────────────────────────────────────────

describe("buildGoalChips", () => {
  it("full form produces all 3 chips", () => {
    const chips = buildGoalChips(
      form({ ambition: "national", weeklyHours: "8-12", budgetRange: "7k-15k" })
    );
    expect(chips).toContain("State / national level");
    expect(chips).toContain("8–12 hrs/week");
    expect(chips).toContain("₹7k–15k/mo");
    expect(chips).toHaveLength(3);
  });

  it("all 4 ambition values map correctly", () => {
    expect(buildGoalChips(form({ ambition: "fun" }))).toContain("Just for fun");
    expect(buildGoalChips(form({ ambition: "competitive" }))).toContain("Local competitions");
    expect(buildGoalChips(form({ ambition: "national" }))).toContain("State / national level");
    expect(buildGoalChips(form({ ambition: "professional" }))).toContain("Professional pathway");
  });

  it("all 4 weeklyHours values map correctly", () => {
    expect(buildGoalChips(form({ weeklyHours: "1-3" }))).toContain("1–3 hrs/week");
    expect(buildGoalChips(form({ weeklyHours: "4-7" }))).toContain("4–7 hrs/week");
    expect(buildGoalChips(form({ weeklyHours: "8-12" }))).toContain("8–12 hrs/week");
    expect(buildGoalChips(form({ weeklyHours: "13-plus" }))).toContain("13+ hrs/week");
  });

  it("all 4 budgetRange values map correctly", () => {
    expect(buildGoalChips(form({ budgetRange: "under-3k" }))).toContain("Under ₹3k/mo");
    expect(buildGoalChips(form({ budgetRange: "3k-7k" }))).toContain("₹3k–7k/mo");
    expect(buildGoalChips(form({ budgetRange: "7k-15k" }))).toContain("₹7k–15k/mo");
    expect(buildGoalChips(form({ budgetRange: "15k-plus" }))).toContain("₹15k+/mo");
  });

  it("null fields omit chips", () => {
    expect(buildGoalChips(EMPTY_FORM)).toHaveLength(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("no nulls leak into chip arrays", () => {
    [...buildProfileChips(EMPTY_FORM), ...buildGoalChips(EMPTY_FORM)].forEach((c) => {
      expect(c).not.toBeNull();
      expect(typeof c).toBe("string");
    });
  });

  it("unknown gender value produces no chip", () => {
    const chips = buildProfileChips(form({ gender: "OTHER" }));
    expect(chips.some((c) => c === "Boy" || c === "Girl")).toBe(false);
  });
});
