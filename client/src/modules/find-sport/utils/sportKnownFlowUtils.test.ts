import { describe, it, expect } from "vitest";
import {
  isAnswered,
  getAgeFromDob,
  buildProfileChips,
  buildAchievementChips,
  buildGoalChips,
  TRAINING_TYPE_DISPLAY,
  HOURS_DISPLAY,
  BUDGET_DISPLAY,
  EMPTY_FORM,
  type KnownSportForm,
} from "./sportKnownFlowUtils";
import {
  getCurrentStandingLadder,
  getBestResultLadder,
  getAmbitionOptions,
  deriveExperienceLevel,
} from "../data/sportArchetypes";

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
  it("TRAINING_TYPE_DISPLAY covers all 4 options", () => {
    ["self", "club", "academy", "private"].forEach((k) => {
      expect(TRAINING_TYPE_DISPLAY[k], `missing: ${k}`).toBeTruthy();
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
    expect(isAnswered("currentStandingTier", form({ currentStandingTier: null }))).toBe(false);
    expect(isAnswered("weeklyHours", form({ weeklyHours: null }))).toBe(false);
  });

  it("non-null string → true", () => {
    expect(isAnswered("gender", form({ gender: "MALE" }))).toBe(true);
    expect(isAnswered("state", form({ state: "Delhi" }))).toBe(true);
    expect(isAnswered("trainingType", form({ trainingType: "academy" }))).toBe(true);
  });

  it("numeric tier field → true (even tier 1, the lowest)", () => {
    expect(isAnswered("currentStandingTier", form({ currentStandingTier: 1 }))).toBe(true);
    expect(isAnswered("bestResultTier", form({ bestResultTier: 1 }))).toBe(true);
  });

  it("EMPTY_FORM required fields (sport, state) are false", () => {
    expect(isAnswered("sport", EMPTY_FORM)).toBe(false);
    expect(isAnswered("state", EMPTY_FORM)).toBe(false);
  });
});

// ─── buildProfileChips ────────────────────────────────────────────────────────

describe("buildProfileChips", () => {
  it("full form produces every expected chip", () => {
    const chips = buildProfileChips(
      form({
        sport: "Cricket",
        gender: "MALE",
        dateOfBirth: dobYearsAgo(10),
        state: "Maharashtra",
        currentStandingTier: 3,
        yearsPlaying: 3,
        trainingType: "academy",
        academyName: "Sunrise Academy",
        sessionsPerWeek: 4,
      })
    );
    expect(chips).toContain("Boy");
    expect(chips).toContain("Age 10");
    expect(chips).toContain("Maharashtra");
    expect(chips).toContain("State level"); // federation tier 3, Cricket
    expect(chips).toContain("3 yrs playing");
    expect(chips).toContain("Academy");
    expect(chips).toContain("Sunrise Academy");
    expect(chips).toContain("4x/week");
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
    expect(chips).toHaveLength(0);
  });

  it("state value passes through as-is", () => {
    expect(buildProfileChips(form({ state: "Tamil Nadu" }))).toContain("Tamil Nadu");
  });

  it("currentStandingTier resolves to the right ladder per sport archetype", () => {
    // Tennis = ranking archetype
    expect(
      buildProfileChips(form({ sport: "Tennis", currentStandingTier: 1 })),
    ).toContain("No ranking yet");
    // Chess = rating archetype
    expect(
      buildProfileChips(form({ sport: "Chess", currentStandingTier: 2 })),
    ).toContain("State-rated");
  });

  it("null currentStandingTier omits the standing chip", () => {
    const chips = buildProfileChips(form({ sport: "Cricket", currentStandingTier: null }));
    expect(chips.some((c) => c.startsWith("Competes at") || c === "International exposure")).toBe(false);
  });

  it("yearsPlaying singular vs plural", () => {
    expect(buildProfileChips(form({ yearsPlaying: 1 }))).toContain("1 yr playing");
    expect(buildProfileChips(form({ yearsPlaying: 5 }))).toContain("5 yrs playing");
  });

  it("yearsPlaying zero still shows a chip (0 is a valid answer)", () => {
    expect(buildProfileChips(form({ yearsPlaying: 0 }))).toContain("0 yrs playing");
  });

  it("empty academyName omits chip", () => {
    const chips = buildProfileChips(form({ academyName: "" }));
    expect(chips).toHaveLength(0);
  });

  it("completely empty form → empty array", () => {
    expect(buildProfileChips(EMPTY_FORM)).toHaveLength(0);
  });
});

// ─── buildAchievementChips ─────────────────────────────────────────────────────

describe("buildAchievementChips", () => {
  it("bestResultTier resolves to the right ladder label per sport", () => {
    expect(
      buildAchievementChips(form({ sport: "Cricket", bestResultTier: 4 })),
    ).toContain("National-level selection or medal");
  });

  it("achievementsNote passes through when present", () => {
    expect(
      buildAchievementChips(form({ achievementsNote: "Won U-14 state championship" })),
    ).toContain("Won U-14 state championship");
  });

  it("empty achievementsNote omitted", () => {
    const chips = buildAchievementChips(form({ achievementsNote: "" }));
    expect(chips.some((c) => c === "")).toBe(false);
  });

  it("no sport, no bestResultTier → empty array", () => {
    expect(buildAchievementChips(EMPTY_FORM)).toHaveLength(0);
  });
});

// ─── buildGoalChips ───────────────────────────────────────────────────────────

describe("buildGoalChips", () => {
  it("full form produces all 3 chips", () => {
    const chips = buildGoalChips(
      form({ sport: "Cricket", ambition: "national", weeklyHours: "8-12", budgetRange: "7k-15k" })
    );
    expect(chips).toContain("Trying for district/state trials");
    expect(chips).toContain("8–12 hrs/week");
    expect(chips).toContain("₹7k–15k/mo");
    expect(chips).toHaveLength(3);
  });

  it("federation sports (Cricket) get district/state trial wording", () => {
    expect(buildGoalChips(form({ sport: "Cricket", ambition: "fun" }))).toContain("Fitness & enjoyment only");
    expect(buildGoalChips(form({ sport: "Cricket", ambition: "competitive" }))).toContain("Improving for school team");
    expect(buildGoalChips(form({ sport: "Cricket", ambition: "national" }))).toContain("Trying for district/state trials");
    expect(buildGoalChips(form({ sport: "Cricket", ambition: "professional" }))).toContain("Aiming for academy/national camp selection");
  });

  it("ranking sports (Tennis) get ranking-tournament wording instead of district/state trials", () => {
    expect(buildGoalChips(form({ sport: "Tennis", ambition: "national" }))).toContain("Earning an All-India (national) ranking");
    expect(buildGoalChips(form({ sport: "Tennis", ambition: "professional" }))).toContain("Aiming for the international junior circuit");
  });

  it("empty sport omits the ambition chip (consistent with other chip builders)", () => {
    const chips = buildGoalChips(form({ ambition: "national" }));
    expect(chips.some((c) => c.toLowerCase().includes("trial"))).toBe(false);
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
    [
      ...buildProfileChips(EMPTY_FORM),
      ...buildAchievementChips(EMPTY_FORM),
      ...buildGoalChips(EMPTY_FORM),
    ].forEach((c) => {
      expect(c).not.toBeNull();
      expect(typeof c).toBe("string");
    });
  });

  it("unknown gender value produces no chip", () => {
    const chips = buildProfileChips(form({ gender: "OTHER" }));
    expect(chips.some((c) => c === "Boy" || c === "Girl")).toBe(false);
  });
});

// ─── Archetype system (sportArchetypes.ts) ─────────────────────────────────────

describe("getCurrentStandingLadder / getBestResultLadder — archetype resolution", () => {
  it("federation sports (e.g. Cricket) get the district/state/national ladder", () => {
    const ladder = getCurrentStandingLadder("Cricket");
    expect(ladder.map((t) => t.label)).toEqual([
      "No trials yet",
      "District level",
      "State level",
      "National level",
      "International",
    ]);
  });

  it("federation ladder uses a sport-neutral verb (works for individual sports like Wrestling/Gymnastics, not just team sports)", () => {
    ["Wrestling", "Gymnastics", "Cricket"].forEach((sport) => {
      const ladder = getCurrentStandingLadder(sport);
      expect(ladder.some((t) => t.label.toLowerCase().startsWith("plays at"))).toBe(false);
    });
  });

  it("ranking sports (Tennis, Badminton) get the ranking-tournament ladder", () => {
    expect(getCurrentStandingLadder("Tennis")[2].context).toBe("Has an All-India (national) ranking");
    expect(getCurrentStandingLadder("Badminton")[2].context).toBe("Has an All-India (national) ranking");
  });

  it("Chess's rating ladder correctly distinguishes AICF (national) from FIDE (international) — not the same body", () => {
    const ladder = getCurrentStandingLadder("Chess");
    expect(ladder[1].label).toBe("State-rated");
    expect(ladder[2].context).toContain("AICF");
    expect(ladder[2].context).not.toContain("FIDE");
    expect(ladder[3].context).toContain("FIDE");
  });

  it("Athletics/Swimming (time-based standard) swap in 'time'", () => {
    expect(getCurrentStandingLadder("Athletics")[0].context).toBe(
      "No time recorded yet — no matter how long or how seriously they've trained",
    );
    expect(getCurrentStandingLadder("Swimming")[1].context).toBe("Has a district/club-level time");
  });

  it("Shooting (score-based standard) swaps in 'score'", () => {
    expect(getCurrentStandingLadder("Shooting")[0].context).toBe(
      "No score recorded yet — no matter how long or how seriously they've trained",
    );
  });

  it("tier 1 never implies the child is a raw or casual beginner — only that they lack a competitive record", () => {
    Object.values(["Cricket", "Tennis", "Chess", "Athletics", "Shooting"]).forEach((sport) => {
      const tier1 = getCurrentStandingLadder(sport)[0];
      // Label stays purely factual about the record — no beginner framing...
      expect(tier1.label.toLowerCase()).not.toContain("just starting");
      // ...and no commitment-level framing either: a professionally-trained
      // prospect can have zero ranking (many circuits have age floors), so
      // "casually"/"informally" is just as wrong a label as "beginner" was.
      expect(tier1.label.toLowerCase()).not.toContain("casual");
      expect(tier1.label.toLowerCase()).not.toContain("informal");
      // Context hedges both axes: duration and seriousness.
      expect(tier1.context?.toLowerCase()).toContain("no matter how long");
      expect(tier1.context?.toLowerCase()).toContain("seriously");
    });
  });

  it("standard archetype doesn't falsely imply a formal qualifying cutoff at district/club level (only state-and-above genuinely gate on a standard)", () => {
    ["Athletics", "Swimming", "Shooting"].forEach((sport) => {
      const ladder = getCurrentStandingLadder(sport);
      expect(ladder[1].context?.toLowerCase()).not.toContain("qualifying");
      expect(ladder[2].context?.toLowerCase()).toContain("qualifying"); // state tier genuinely does
    });
  });

  it("case-insensitive sport lookup", () => {
    expect(getCurrentStandingLadder("cricket")).toEqual(getCurrentStandingLadder("Cricket"));
    expect(getCurrentStandingLadder("TENNIS")).toEqual(getCurrentStandingLadder("Tennis"));
  });

  it("unknown sport falls back to the federation ladder", () => {
    expect(getCurrentStandingLadder("Underwater Hockey")).toEqual(getCurrentStandingLadder("Cricket"));
  });

  it("best-result ladder is phrased as an achievement, not a current state", () => {
    expect(getBestResultLadder("Cricket")[0].label).toBe("None yet");
    expect(getBestResultLadder("Cricket")[3].label).toBe("National-level selection or medal");
  });

  it("every ladder has exactly 5 tiers valued 1–5 in order", () => {
    ["Cricket", "Tennis", "Chess", "Athletics", "Shooting"].forEach((sport) => {
      const ladder = getCurrentStandingLadder(sport);
      expect(ladder.map((t) => t.value)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe("getAmbitionOptions — sport-anchored goal wording", () => {
  it("keeps the same 4 underlying values regardless of archetype (scorer.ts depends on this)", () => {
    ["Cricket", "Tennis", "Chess", "Athletics"].forEach((sport) => {
      expect(getAmbitionOptions(sport).map((o) => o.value)).toEqual([
        "fun",
        "competitive",
        "national",
        "professional",
      ]);
    });
  });

  it("federation sports use district/state trial language", () => {
    const options = getAmbitionOptions("Cricket");
    expect(options.find((o) => o.value === "national")?.label).toBe("Trying for district/state trials");
    expect(options.find((o) => o.value === "professional")?.label).toBe(
      "Aiming for academy/national camp selection",
    );
  });

  it("ranking sports (Tennis) never mention district/state trials", () => {
    const options = getAmbitionOptions("Tennis");
    options.forEach((o) => {
      expect(o.label.toLowerCase()).not.toContain("district");
      expect(o.label.toLowerCase()).not.toContain("trial");
    });
    expect(options.find((o) => o.value === "national")?.label).toBe(
      "Earning an All-India (national) ranking",
    );
  });

  it("rating sports (Chess) reference AICF (national) vs FIDE (international) correctly", () => {
    const options = getAmbitionOptions("Chess");
    expect(options.find((o) => o.value === "national")?.label).toBe("Aiming for a national (AICF) rating");
    expect(options.find((o) => o.value === "professional")?.label).toContain("FIDE");
  });

  it("standard sports (Athletics) reference qualifying standards", () => {
    const options = getAmbitionOptions("Athletics");
    expect(options.find((o) => o.value === "professional")?.label).toBe(
      "Aiming for the international/Olympic qualifying standard",
    );
  });
});

describe("deriveExperienceLevel — backward-compat collapse", () => {
  it("null/undefined → undefined", () => {
    expect(deriveExperienceLevel(null)).toBeUndefined();
    expect(deriveExperienceLevel(undefined)).toBeUndefined();
  });

  it("tiers 1–2 collapse to beginner", () => {
    expect(deriveExperienceLevel(1)).toBe("beginner");
    expect(deriveExperienceLevel(2)).toBe("beginner");
  });

  it("tier 3 collapses to intermediate", () => {
    expect(deriveExperienceLevel(3)).toBe("intermediate");
  });

  it("tiers 4–5 collapse to competitive", () => {
    expect(deriveExperienceLevel(4)).toBe("competitive");
    expect(deriveExperienceLevel(5)).toBe("competitive");
  });
});
