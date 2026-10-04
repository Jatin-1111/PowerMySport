import { describe, expect, it } from "vitest";

import type { Opportunity } from "../src/modules/opportunities/services/opportunities";
import {
  daysUntil,
  deadlineLine,
  describeListing,
  eligibilityChips,
} from "../src/modules/opportunities/utils/format";
import {
  EMPTY_PROFILE,
  checkOpportunity,
  hasProfile,
  type ChildProfile,
} from "../src/modules/opportunities/utils/match";

type Matchable = Pick<Opportunity, "sports" | "allSports" | "geography" | "eligibility">;

const entry = (overrides: Partial<Matchable> = {}): Matchable => ({
  sports: [],
  allSports: true,
  geography: { scope: "india" },
  eligibility: undefined,
  ...overrides,
});
const child = (overrides: Partial<ChildProfile> = {}): ChildProfile => ({
  ...EMPTY_PROFILE,
  ...overrides,
});
const stateOf = (checks: ReturnType<typeof checkOpportunity>["checks"], key: string) =>
  checks.find((check) => check.key === key)?.state;

describe("checkOpportunity: nothing known about the child", () => {
  it("gives no verdict until the parent has said something", () => {
    expect(hasProfile(EMPTY_PROFILE)).toBe(false);
    expect(checkOpportunity(entry(), EMPTY_PROFILE).verdict).toBeNull();
  });
});

describe("checkOpportunity: age", () => {
  const aged = entry({ eligibility: { ageMin: 10, ageMax: 14 } });

  it("passes an age inside the range, bounds included", () => {
    for (const age of [10, 12, 14]) {
      expect(stateOf(checkOpportunity(aged, child({ age })).checks, "age")).toBe("pass");
    }
  });

  it("fails an age outside it, on either side", () => {
    expect(stateOf(checkOpportunity(aged, child({ age: 9 })).checks, "age")).toBe("fail");
    expect(stateOf(checkOpportunity(aged, child({ age: 15 })).checks, "age")).toBe("fail");
  });

  it("cannot judge the age until it is given", () => {
    expect(stateOf(checkOpportunity(aged, child({ sport: "tennis" })).checks, "age")).toBe(
      "unknown"
    );
  });

  it("handles a one-sided limit", () => {
    const under16 = entry({ eligibility: { ageMax: 16 } });
    expect(stateOf(checkOpportunity(under16, child({ age: 16 })).checks, "age")).toBe("pass");
    expect(stateOf(checkOpportunity(under16, child({ age: 17 })).checks, "age")).toBe("fail");
    const over18 = entry({ eligibility: { ageMin: 18 } });
    expect(stateOf(checkOpportunity(over18, child({ age: 17 })).checks, "age")).toBe("fail");
  });

  it("leaves an age written as a note, like grades, for the parent to judge", () => {
    const grades = entry({ eligibility: { ageNote: "Students in grades 7-12" } });
    const result = checkOpportunity(grades, child({ age: 12 }));

    expect(stateOf(result.checks, "age")).toBe("manual");
    expect(result.verdict).toBe("check");
  });
});

describe("checkOpportunity: sport", () => {
  it("passes any sport for an all-sports scheme", () => {
    expect(stateOf(checkOpportunity(entry(), child({ sport: "chess" })).checks, "sport")).toBe(
      "pass"
    );
  });

  it("matches a named sport, and fails another", () => {
    const tennis = entry({ allSports: false, sports: ["tennis"] });
    expect(stateOf(checkOpportunity(tennis, child({ sport: "tennis" })).checks, "sport")).toBe(
      "pass"
    );
    expect(stateOf(checkOpportunity(tennis, child({ sport: "chess" })).checks, "sport")).toBe(
      "fail"
    );
  });

  it("is unknown until a sport is chosen", () => {
    const tennis = entry({ allSports: false, sports: ["tennis"] });
    expect(stateOf(checkOpportunity(tennis, child({ age: 12 })).checks, "sport")).toBe("unknown");
  });
});

describe("checkOpportunity: gender and place", () => {
  it("only lists a gender row when the scheme restricts it", () => {
    expect(
      checkOpportunity(entry(), child({ gender: "girl" })).checks.map((c) => c.key)
    ).not.toContain("gender");
  });

  it("matches a girls-only scheme to a girl and fails a boy", () => {
    const girls = entry({ eligibility: { gender: "female" } });
    expect(stateOf(checkOpportunity(girls, child({ gender: "girl" })).checks, "gender")).toBe(
      "pass"
    );
    expect(stateOf(checkOpportunity(girls, child({ gender: "boy" })).checks, "gender")).toBe(
      "fail"
    );
  });

  it("requires the state for a state scheme, ignoring case", () => {
    const haryana = entry({ geography: { scope: "state", state: "Haryana" } });
    expect(stateOf(checkOpportunity(haryana, child({ state: "haryana" })).checks, "where")).toBe(
      "pass"
    );
    expect(stateOf(checkOpportunity(haryana, child({ state: "Punjab" })).checks, "where")).toBe(
      "fail"
    );
    expect(stateOf(checkOpportunity(haryana, child({ age: 12 })).checks, "where")).toBe("unknown");
  });

  it("asks nothing of the state for a national scheme", () => {
    expect(stateOf(checkOpportunity(entry(), child({ state: "Kerala" })).checks, "where")).toBe(
      "pass"
    );
  });
});

describe("checkOpportunity: rules written in words", () => {
  const wordy = entry({
    eligibility: {
      level: "Played nationally in the last two years",
      academic: "At least 70% marks",
      income: "Family income under INR 5 lakh",
    },
  });

  it("never ticks marks, income or level on the parent's behalf", () => {
    const { checks } = checkOpportunity(wordy, child({ age: 12, sport: "tennis" }));

    for (const key of ["level", "academic", "income"]) {
      expect(stateOf(checks, key)).toBe("manual");
    }
  });

  it("therefore never says 'fits' while any of them remains", () => {
    expect(
      checkOpportunity(wordy, child({ age: 12, sport: "tennis", state: "Punjab" })).verdict
    ).toBe("check");
  });
});

describe("checkOpportunity: an entry with no rules on file", () => {
  it("says so, instead of passing silently", () => {
    const { checks } = checkOpportunity(entry(), child({ sport: "tennis" }));

    expect(stateOf(checks, "rules")).toBe("manual");
  });

  it("is never 'fits', however well the little we know matches", () => {
    const result = checkOpportunity(entry(), child({ age: 12, sport: "tennis", state: "Punjab" }));

    expect(result.verdict).toBe("check");
  });

  it("adds no such row once there is a rule", () => {
    const { checks } = checkOpportunity(
      entry({ eligibility: { ageMin: 10, ageMax: 14 } }),
      child({ age: 12 })
    );

    expect(stateOf(checks, "rules")).toBeUndefined();
  });

  it("does not count a gender of 'any' as a rule", () => {
    const { checks } = checkOpportunity(
      entry({ eligibility: { gender: "any" } }),
      child({ age: 12 })
    );

    expect(stateOf(checks, "rules")).toBe("manual");
  });
});

describe("checkOpportunity: the verdict", () => {
  it("is 'fits' only when everything held in structured form passes and nothing is left to judge", () => {
    const rules = entry({
      allSports: false,
      sports: ["tennis"],
      eligibility: { ageMin: 10, ageMax: 14, gender: "female" },
    });

    expect(
      checkOpportunity(rules, child({ age: 12, sport: "tennis", gender: "girl" })).verdict
    ).toBe("fits");
  });

  it("is 'no' as soon as one rule fails, whatever else passes", () => {
    const rules = entry({
      allSports: false,
      sports: ["tennis"],
      eligibility: { ageMin: 10, ageMax: 14 },
    });

    expect(checkOpportunity(rules, child({ age: 16, sport: "tennis" })).verdict).toBe("no");
  });

  it("is 'check' when something could still be checked but the child has not been described enough", () => {
    const rules = entry({ allSports: false, sports: ["tennis"], eligibility: { ageMin: 10 } });

    expect(checkOpportunity(rules, child({ age: 12 })).verdict).toBe("check");
  });
});

describe("eligibilityChips", () => {
  it("states the age range and any gender limit", () => {
    expect(eligibilityChips({ ageMin: 10, ageMax: 14, gender: "female" })).toEqual([
      "Ages 10 to 14",
      "Girls and women only",
    ]);
    expect(eligibilityChips({ ageMax: 16 })).toEqual(["Up to age 16"]);
    expect(eligibilityChips({ ageMin: 18, gender: "male" })).toEqual([
      "Age 18 and over",
      "Boys and men only",
    ]);
  });

  it("falls back to the age note, shortened at a word", () => {
    const [chip] = eligibilityChips({
      ageNote: "Students in grades 7 to 12 at a recognised school across the country",
    });

    expect(chip.endsWith("…")).toBe(true);
    expect(chip.length).toBeLessThanOrEqual(31);
    expect(chip).not.toMatch(/\s…$/);
  });

  it("is empty when there is nothing to say", () => {
    expect(eligibilityChips(undefined)).toEqual([]);
    expect(eligibilityChips({ gender: "any" })).toEqual([]);
  });
});

describe("daysUntil and deadlineLine", () => {
  it("counts whole calendar days, and is null once the day has passed", () => {
    expect(daysUntil("2026-10-13", "2026-10-03")).toBe(10);
    expect(daysUntil("2026-10-03", "2026-10-03")).toBe(0);
    expect(daysUntil("2026-10-02", "2026-10-03")).toBeNull();
    expect(daysUntil("not-a-date", "2026-10-03")).toBeNull();
  });

  const open = (closesOn: string) => ({
    cycleState: "open" as const,
    cycle: { closesOn, keyDates: [] },
  });

  it("says when an open window closes and how long is left", () => {
    expect(deadlineLine(open("2026-10-13"), "2026-10-03")).toEqual({
      text: "Closes 13 Oct 2026 · 10 days left",
      urgent: true,
    });
  });

  it("is only urgent inside two weeks", () => {
    expect(deadlineLine(open("2026-10-17"), "2026-10-03")?.urgent).toBe(true);
    expect(deadlineLine(open("2026-10-18"), "2026-10-03")?.urgent).toBe(false);
  });

  it("handles the last day and the day before", () => {
    expect(deadlineLine(open("2026-10-03"), "2026-10-03")?.text).toContain("closes today");
    expect(deadlineLine(open("2026-10-04"), "2026-10-03")?.text).toContain("1 day left");
  });

  it("describes windows that have not opened, and ones that have shut", () => {
    expect(
      deadlineLine(
        { cycleState: "upcoming", cycle: { opensOn: "2026-11-01", keyDates: [] } },
        "2026-10-03"
      )?.text
    ).toBe("Opens 1 Nov 2026");
    expect(
      deadlineLine({ cycleState: "closed", cycle: { keyDates: [] } }, "2026-10-03")?.text
    ).toBe("Closed for this cycle");
  });

  it("says nothing for an entry with no fixed window", () => {
    expect(
      deadlineLine({ cycleState: "rolling", cycle: { keyDates: [] } }, "2026-10-03")
    ).toBeNull();
  });
});

describe("describeListing", () => {
  const base = "Sports scholarships for young athletes in India.";

  it("adds nothing when nothing is published, so it cannot promise anything", () => {
    expect(describeListing(base, [])).toBe(base);
  });

  it("names what is actually listed", () => {
    expect(describeListing(base, ["GIIS Global Sports Scholarship"])).toBe(
      `${base} Listed now: GIIS Global Sports Scholarship.`
    );
    expect(describeListing(base, ["A", "B"])).toContain("A and B");
  });

  it("names the first three and counts the rest", () => {
    expect(describeListing(base, ["A", "B", "C", "D", "E"])).toContain("A, B and C and 2 more");
  });
});
