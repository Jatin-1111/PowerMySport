import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ageFromDob,
  ambitionTargetRawLevel,
  firstName,
  getAgeFit,
  getBudgetFit,
  loadGuestPersona,
  personaFromDependent,
  personaRawLevel,
  possessive,
} from "./persona";

// node-env localStorage stub
function stubLocalStorage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("window", {} as any);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as any);
}

afterEach(() => vi.unstubAllGlobals());

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("name helpers", () => {
  it("firstName takes the first token, trims, and rejects empties", () => {
    expect(firstName("Aarav Sharma")).toBe("Aarav");
    expect(firstName("  Diya  ")).toBe("Diya");
    expect(firstName("")).toBeUndefined();
    expect(firstName(undefined)).toBeUndefined();
  });

  it("possessive appends ’s", () => {
    expect(possessive("Aarav")).toBe("Aarav’s");
  });
});

describe("personaFromDependent", () => {
  it("maps the dependent record, preferring dob over stored age", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 11);
    dob.setMonth(dob.getMonth() - 1);
    const p = personaFromDependent({
      name: "Aarav Sharma",
      dob: dob.toISOString(),
      age: 9, // stale wizard-time age — dob wins
      location: "Punjab",
      ambition: "national",
      budgetRange: "3k-7k",
      weeklyHoursCategory: "4-7",
      currentStandingTier: 2,
      experienceLevel: "beginner",
      sportsFocus: ["Badminton"],
    });
    expect(p).toMatchObject({
      source: "dependent",
      name: "Aarav",
      age: 11,
      state: "Punjab",
      ambition: "national",
      budgetRange: "3k-7k",
      standingTier: 2,
      sports: ["badminton"],
    });
  });
});

describe("personaRawLevel", () => {
  const base = {
    source: "dependent" as const,
    standingTier: 2,
    experienceLevel: "competitive" as const,
    sports: ["badminton"],
  };

  it("uses the standing tier when the sport matches", () => {
    expect(personaRawLevel(base, "Badminton")).toBe(2);
  });

  it("falls back to experienceLevel when no tier", () => {
    expect(
      personaRawLevel({ ...base, standingTier: undefined }, "badminton"),
    ).toBe(4);
  });

  it("never pins a level for a sport we weren't told about", () => {
    expect(personaRawLevel(base, "Cricket")).toBeNull();
  });

  it("handles null persona", () => {
    expect(personaRawLevel(null, "Badminton")).toBeNull();
  });
});

describe("ambitionTargetRawLevel", () => {
  it("maps ambitions to goal levels, with fun deliberately unpinned", () => {
    expect(ambitionTargetRawLevel("fun")).toBeNull();
    expect(ambitionTargetRawLevel("competitive")).toBe(3);
    expect(ambitionTargetRawLevel("national")).toBe(4);
    expect(ambitionTargetRawLevel("professional")).toBe(5);
    expect(ambitionTargetRawLevel(undefined)).toBeNull();
  });
});

describe("fit helpers", () => {
  it("getAgeFit parses merged range labels", () => {
    expect(getAgeFit("8 – 14 years", 11)).toEqual({ fit: "within", min: 8, max: 14 });
    expect(getAgeFit("8 – 14 years", 6)?.fit).toBe("younger");
    expect(getAgeFit("8 – 14 years", 16)?.fit).toBe("older");
    expect(getAgeFit(undefined, 11)).toBeNull();
    expect(getAgeFit("varies", 11)).toBeNull();
  });

  it("getBudgetFit compares stage fee bounds with the family ceiling", () => {
    expect(getBudgetFit({ low: 1000, high: 3000 }, "3k-7k")).toBe("within");
    expect(getBudgetFit({ low: 3000, high: 10000 }, "3k-7k")).toBe("stretch");
    expect(getBudgetFit({ low: 10000, high: 30000 }, "3k-7k")).toBe("above");
    expect(getBudgetFit({ low: 30000, high: 80000 }, "15k-plus")).toBe("within");
    expect(getBudgetFit(null, "3k-7k")).toBeNull();
    expect(getBudgetFit({ low: 1000, high: 3000 }, undefined)).toBeNull();
  });
});

describe("loadGuestPersona", () => {
  it("returns null with no stored data", () => {
    stubLocalStorage({});
    expect(loadGuestPersona()).toBeNull();
  });

  it("reads the discover wizard's answers", () => {
    stubLocalStorage({
      pms_wizard_results: JSON.stringify({
        answers: { childName: "Diya Patel", age: 9, state: "Kerala", budget: "7k-15k", ambition: "competitive" },
        savedAt: daysAgo(1),
      }),
    });
    expect(loadGuestPersona()).toMatchObject({
      source: "guest",
      name: "Diya",
      age: 9,
      state: "Kerala",
      budgetRange: "7k-15k",
      ambition: "competitive",
      sports: [],
    });
  });

  it("sport-profile answers win per-field and carry the standing tier", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 12);
    dob.setMonth(dob.getMonth() - 2);
    stubLocalStorage({
      pms_wizard_results: JSON.stringify({
        answers: { childName: "Diya", age: 9, state: "Kerala", budget: "7k-15k" },
        savedAt: daysAgo(2),
      }),
      pms_sport_profile: JSON.stringify({
        form: {
          sport: "Tennis",
          childName: "Aarav",
          dateOfBirth: dob.toISOString().slice(0, 10),
          state: null,
          ambition: "national",
          budgetRange: null,
          currentStandingTier: 3,
        },
        savedAt: daysAgo(1),
      }),
    });
    expect(loadGuestPersona()).toMatchObject({
      name: "Aarav",
      age: 12,
      state: "Kerala", // wizard fills the gap
      ambition: "national",
      budgetRange: "7k-15k", // wizard fills the gap
      standingTier: 3,
      sports: ["tennis"],
    });
  });

  it("ignores stale sources", () => {
    stubLocalStorage({
      pms_wizard_results: JSON.stringify({
        answers: { childName: "Diya", age: 9 },
        savedAt: daysAgo(10),
      }),
    });
    expect(loadGuestPersona()).toBeNull();
  });

  it("survives corrupt JSON", () => {
    stubLocalStorage({ pms_wizard_results: "{not json" });
    expect(loadGuestPersona()).toBeNull();
  });
});

describe("ageFromDob", () => {
  it("computes completed years and rejects out-of-range", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 10);
    dob.setMonth(dob.getMonth() - 3);
    expect(ageFromDob(dob.toISOString())).toBe(10);
    expect(ageFromDob("not-a-date")).toBeUndefined();
    expect(ageFromDob("1950-01-01")).toBeUndefined();
    expect(ageFromDob(undefined)).toBeUndefined();
  });
});
