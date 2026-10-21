import { describe, it, expect } from "vitest";
import {
  buildKnownSportFields,
  isAnswered,
  getAgeFromDob,
  EMPTY_FORM,
  type KnownSportForm,
} from "./sportKnownFlowUtils";
import {
  getCurrentStandingLadder,
  getBestResultLadder,
  getAmbitionOptions,
  getGoverningBodyName,
  sportAsksBestResult,
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
  });

  it("EMPTY_FORM required fields (sport, state) are false", () => {
    expect(isAnswered("sport", EMPTY_FORM)).toBe(false);
    expect(isAnswered("state", EMPTY_FORM)).toBe(false);
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

  it("an authored per-sport ladder overrides its archetype's generic one", () => {
    // Cricket is unauthored and must still get its archetype ladder verbatim,
    // while Tennis (authored) must not.
    expect(getCurrentStandingLadder("Cricket")[1].label).toBe("District level");
    expect(getCurrentStandingLadder("Tennis")[1].label).not.toBe("District level");
  });

  it("every sport on the `ranking` archetype now has an authored ladder, and no two are alike", () => {
    const RANKING_SPORTS = ["Tennis", "Badminton", "Table Tennis", "Squash"];
    RANKING_SPORTS.forEach((sport) => expect(getGoverningBodyName(sport)).not.toBeNull());

    // Same archetype, four genuinely different circuits — the whole point of
    // this layer. Serialise so a ladder can't be quietly duplicated.
    const shapes = RANKING_SPORTS.map((s) => JSON.stringify(getCurrentStandingLadder(s)));
    expect(new Set(shapes).size).toBe(RANKING_SPORTS.length);
  });

  it("Squash's ladder is graded by star rating — that's how SRFI actually grades its junior circuit", () => {
    const blob = getCurrentStandingLadder("Squash")
      .map((t) => `${t.label} ${t.context ?? ""}`)
      .join(" ")
      .toLowerCase();
    expect(blob).toContain("star");
    expect(blob).toContain("slam");
  });

  it("Badminton and Table Tennis KEEP a state rung — unlike tennis, state play is real in both (BAI issues the mandatory BAI ID through the state association; TTFI allots national entry off the published state ranking)", () => {
    ["Badminton", "Table Tennis"].forEach((sport) => {
      const hasStateRung = getCurrentStandingLadder(sport).some((t) =>
        `${t.label} ${t.context ?? ""}`.toLowerCase().includes("state")
      );
      expect(hasStateRung).toBe(true);
    });
  });

  it("Table Tennis resolves from both the name and the slug", () => {
    expect(getCurrentStandingLadder("table-tennis")).toEqual(
      getCurrentStandingLadder("Table Tennis")
    );
    expect(getGoverningBodyName("table-tennis")).toBe("TTFI");
  });

  it("Tennis's ladder has no state rung — AITA's junior circuit is individual entry by ranking with no state selection step", () => {
    [...getCurrentStandingLadder("Tennis"), ...getBestResultLadder("Tennis")].forEach((tier) => {
      expect(`${tier.label} ${tier.context ?? ""}`.toLowerCase()).not.toContain("state");
    });
  });

  it("Tennis's ladder is the real AITA circuit, in order", () => {
    expect(getCurrentStandingLadder("Tennis").map((t) => t.label)).toEqual([
      "No AITA ranking yet",
      "Talent / Championship Series",
      "Super Series / National Series",
      "Junior Nationals",
      "ITF junior circuit",
    ]);
  });

  it("names the governing body for authored sports, and stays silent for sports on the generic fallback", () => {
    expect(getGoverningBodyName("Tennis")).toBe("AITA");
    expect(getGoverningBodyName("tennis")).toBe("AITA");
    expect(getGoverningBodyName("Badminton")).toBe("BAI");
    expect(getGoverningBodyName("Table Tennis")).toBe("TTFI");
    expect(getGoverningBodyName("Chess")).toBe("AICF");
    expect(getGoverningBodyName("Squash")).toBe("SRFI");
    expect(getGoverningBodyName("Cricket")).toBeNull();
    expect(getGoverningBodyName("Athletics")).toBeNull();
  });

  it("an authored ladder keeps 5 rungs valued 1-5 — tier numbers are persisted on the Player doc, so a renumber would re-point existing rows", () => {
    ["Tennis", "Badminton", "Table Tennis", "Chess", "Squash"].forEach((sport) => {
      expect(getCurrentStandingLadder(sport).map((t) => t.value)).toEqual([1, 2, 3, 4, 5]);
      expect(getBestResultLadder(sport).map((t) => t.value)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  it("Chess's rating ladder correctly distinguishes AICF (national) from FIDE (international) — not the same body", () => {
    const ladder = getCurrentStandingLadder("Chess");
    expect(ladder[2].label).toBe("AICF rated");
    expect(ladder[2].context).not.toContain("FIDE");
    expect(ladder[3].context).toContain("FIDE");
  });

  it("Chess has no 'state rating' rung — Indian ratings are national (AICF) or international (FIDE), nothing in between", () => {
    getCurrentStandingLadder("Chess").forEach((tier) => {
      expect(tier.label.toLowerCase()).not.toContain("state-rated");
      expect(tier.label.toLowerCase()).not.toContain("state rated");
    });
  });

  it("Athletics/Swimming (time-based standard) swap in 'time'", () => {
    expect(getCurrentStandingLadder("Athletics")[0].context).toBe(
      "No time recorded yet, no matter how long or how seriously they've trained"
    );
    expect(getCurrentStandingLadder("Swimming")[1].context).toBe("Has a district/club-level time");
  });

  it("Shooting (score-based standard) swaps in 'score'", () => {
    expect(getCurrentStandingLadder("Shooting")[0].context).toBe(
      "No score recorded yet, no matter how long or how seriously they've trained"
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
    expect(getCurrentStandingLadder("Underwater Hockey")).toEqual(
      getCurrentStandingLadder("Cricket")
    );
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

describe("getAmbitionOptions — the career tier", () => {
  it("offers `career` as the top goal for every archetype, and no longer offers `professional`", () => {
    ["Cricket", "Tennis", "Chess", "Athletics"].forEach((sport) => {
      const values = getAmbitionOptions(sport).map((o) => o.value);
      expect(values[3]).toBe("career");
      expect(values).not.toContain("professional");
    });
  });

  it("federation sports KEEP their state rung — there the selection pyramid is real", () => {
    const labels = getAmbitionOptions("Cricket").map((o) => o.label.toLowerCase());
    expect(labels.some((l) => l.includes("state"))).toBe(true);
  });
});

describe("sportAsksBestResult — the redundant question", () => {
  it("ranking and rating sports don't ask it — having the ranking IS the result", () => {
    ["Tennis", "Badminton", "Table Tennis", "Squash", "Chess"].forEach((sport) => {
      expect(sportAsksBestResult(sport)).toBe(false);
    });
  });

  it("federation and standard sports still ask it — past selection and current level genuinely diverge there", () => {
    ["Cricket", "Football", "Wrestling", "Athletics", "Swimming", "Shooting"].forEach((sport) => {
      expect(sportAsksBestResult(sport)).toBe(true);
    });
  });

  it("unknown sports fall back to the federation archetype, so they keep the question", () => {
    expect(sportAsksBestResult("Underwater Hockey")).toBe(true);
  });

  it("the best-result ladder stays resolvable even for sports that no longer ask — stored tiers still have to render their label", () => {
    ["Tennis", "Chess"].forEach((sport) => {
      const ladder = getBestResultLadder(sport);
      expect(ladder).toHaveLength(5);
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
        "career",
      ]);
    });
  });

  it("federation sports use district/state trial language", () => {
    const options = getAmbitionOptions("Cricket");
    expect(options.find((o) => o.value === "national")?.label).toBe(
      "Trying for district/state trials"
    );
    expect(options.find((o) => o.value === "career")?.label).toBe("Building a career in sport");
  });

  it("ranking sports (Tennis) never mention district/state trials — or any state rung at all", () => {
    const options = getAmbitionOptions("Tennis");
    options.forEach((o) => {
      expect(o.label.toLowerCase()).not.toContain("district");
      expect(o.label.toLowerCase()).not.toContain("trial");
      // The goal list must match the standing ladder: AITA has no state rung.
      expect(`${o.label} ${o.context}`.toLowerCase()).not.toContain("state");
    });
    expect(options.find((o) => o.value === "national")?.label).toBe(
      "Earning an All-India (national) ranking"
    );
  });

  it("rating sports (Chess) reference AICF (national) vs FIDE (international) correctly", () => {
    const options = getAmbitionOptions("Chess");
    expect(options.find((o) => o.value === "national")?.label).toBe(
      "Aiming for a national (AICF) rating"
    );
    expect(options.find((o) => o.value === "career")?.label).toBe("Building a career in chess");
  });

  it("rating sports (Chess) have no state-rating goal — there is no such thing as a state rating", () => {
    getAmbitionOptions("Chess").forEach((o) => {
      expect(`${o.label} ${o.context}`.toLowerCase()).not.toContain("state");
    });
  });

  it("standard sports (Athletics) reference qualifying standards", () => {
    const options = getAmbitionOptions("Athletics");
    expect(options.find((o) => o.value === "career")?.label).toBe("Building a career in sport");
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

// ─── buildKnownSportFields ───────────────────────────────────────────────────

describe("buildKnownSportFields", () => {
  const now = new Date("2026-10-21T10:00:00.000Z");

  it("saves nothing for an empty form, so a blank flow never clears a profile", () => {
    expect(buildKnownSportFields(form(), now)).toEqual({});
  });

  it("records the sport as a decision, not only an interest", () => {
    const fields = buildKnownSportFields(form({ sport: "Tennis" }), now);

    expect(fields).toMatchObject({
      sportsFocus: ["Tennis"],
      chosenSport: "Tennis",
      chosenSportAt: "2026-10-21T10:00:00.000Z",
    });
  });

  it("derives the experience level from the standing, so the two cannot disagree", () => {
    expect(buildKnownSportFields(form({ currentStandingTier: 1 }), now)).toMatchObject({
      currentStandingTier: 1,
      experienceLevel: "beginner",
    });
    expect(buildKnownSportFields(form({ currentStandingTier: 3 }), now)).toMatchObject({
      experienceLevel: "intermediate",
    });
    expect(buildKnownSportFields(form({ currentStandingTier: 5 }), now)).toMatchObject({
      experienceLevel: "competitive",
    });
  });

  it("keeps a years-playing of 0, which is an answer", () => {
    expect(buildKnownSportFields(form({ yearsPlaying: 0 }), now)).toEqual({ yearsPlaying: 0 });
  });

  it("carries only the questions that were answered", () => {
    const fields = buildKnownSportFields(
      form({ gender: "FEMALE", state: "Delhi", dateOfBirth: "2015-06-01", ambition: "fun" }),
      now
    );

    expect(fields).toEqual({
      gender: "FEMALE",
      location: "Delhi",
      dob: "2015-06-01",
      ambition: "fun",
    });
  });
});
