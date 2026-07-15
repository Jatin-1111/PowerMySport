import { describe, it, expect } from "vitest";
import {
  buildQuestion,
  buildPayload,
  EMPTY_FORM,
  FITNESS_MAP,
  HOURS_MAP,
  BUDGET_MAP,
  OBJECTIVE_MAP,
  WEAKNESS_AREA_LABELS,
  WEAKNESS_CONTEXT_LABELS,
  WEAKNESS_ATTEMPTS_LABELS,
  WEAKNESS_DURATION_LABELS,
  TOURNAMENT_LEVEL_LABELS,
  PHYSICAL_READINESS_LABELS,
  TOURNAMENT_GAP_LABELS,
  CURRENT_LEVEL_LABELS,
  TARGET_LEVEL_LABELS,
  TIME_AT_LEVEL_LABELS,
  TRAINING_TYPE_LABELS,
  BLOCKER_LABELS,
  TOP_STRENGTH_LABELS,
  CHALLENGE_CATEGORY_LABELS,
  DESIRED_OUTCOME_LABELS,
  type ConsultForm,
  type ProblemId,
} from "./consultUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function form(overrides: Partial<ConsultForm> = {}): ConsultForm {
  return { ...EMPTY_FORM, ...overrides };
}

// ─── Label map coverage ────────────────────────────────────────────────────────

describe("label maps — all UI option values are covered", () => {
  it("WEAKNESS_AREA_LABELS covers all 4 options", () => {
    ["technique", "fitness", "mental", "tactical"].forEach((k) => {
      expect(WEAKNESS_AREA_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("WEAKNESS_CONTEXT_LABELS covers all 4 options", () => {
    ["training", "matches", "pressure", "always"].forEach((k) => {
      expect(WEAKNESS_CONTEXT_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("WEAKNESS_ATTEMPTS_LABELS covers all 4 options", () => {
    ["nothing", "practice", "video", "coaching"].forEach((k) => {
      expect(WEAKNESS_ATTEMPTS_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("WEAKNESS_DURATION_LABELS covers all 3 options", () => {
    ["weeks", "months", "year-plus"].forEach((k) => {
      expect(WEAKNESS_DURATION_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TOURNAMENT_LEVEL_LABELS covers all 4 options", () => {
    ["school", "district", "state", "national"].forEach((k) => {
      expect(TOURNAMENT_LEVEL_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("PHYSICAL_READINESS_LABELS covers all 3 options", () => {
    ["low", "moderate", "high"].forEach((k) => {
      expect(PHYSICAL_READINESS_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TOURNAMENT_GAP_LABELS covers all 4 options", () => {
    ["technique", "stamina", "nerves", "matchplay"].forEach((k) => {
      expect(TOURNAMENT_GAP_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("CURRENT_LEVEL_LABELS covers all 4 options", () => {
    ["school", "club", "district", "state"].forEach((k) => {
      expect(CURRENT_LEVEL_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TARGET_LEVEL_LABELS covers all 4 options", () => {
    ["club", "district", "state", "national"].forEach((k) => {
      expect(TARGET_LEVEL_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TIME_AT_LEVEL_LABELS covers all 3 options", () => {
    ["new", "6-12m", "1y-plus"].forEach((k) => {
      expect(TIME_AT_LEVEL_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TRAINING_TYPE_LABELS covers all 4 options", () => {
    ["self", "club", "academy", "private"].forEach((k) => {
      expect(TRAINING_TYPE_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("BLOCKER_LABELS covers all 4 options", () => {
    ["technique", "fitness", "mental", "competition"].forEach((k) => {
      expect(BLOCKER_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("TOP_STRENGTH_LABELS covers all 4 options", () => {
    ["technique", "tactical", "physical", "mental"].forEach((k) => {
      expect(TOP_STRENGTH_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });

  it("CHALLENGE_CATEGORY_LABELS covers all 4 options including nutrition+burnout", () => {
    ["motivation", "injury", "coaching", "nutrition"].forEach((k) => {
      expect(CHALLENGE_CATEGORY_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
    // Burnout is shown in UI alongside nutrition — verify it's in the label
    expect(CHALLENGE_CATEGORY_LABELS["nutrition"]).toContain("burnout");
  });

  it("DESIRED_OUTCOME_LABELS covers all 4 options", () => {
    ["plan", "advice", "resources", "opinion"].forEach((k) => {
      expect(DESIRED_OUTCOME_LABELS[k], `missing key: ${k}`).toBeTruthy();
    });
  });
});

// ─── HOURS_MAP / BUDGET_MAP / FITNESS_MAP ─────────────────────────────────────

describe("conversion maps", () => {
  it("HOURS_MAP covers all 4 UI values", () => {
    expect(HOURS_MAP["1-3"]).toBe(2);
    expect(HOURS_MAP["4-7"]).toBe(6);
    expect(HOURS_MAP["8-12"]).toBe(10);
    expect(HOURS_MAP["13-plus"]).toBe(15);
  });

  it("BUDGET_MAP covers all 4 UI values", () => {
    expect(BUDGET_MAP["under-3k"]).toBe("Budget");
    expect(BUDGET_MAP["3k-7k"]).toBe("Moderate");
    expect(BUDGET_MAP["7k-15k"]).toBe("Moderate");
    expect(BUDGET_MAP["15k-plus"]).toBe("Premium");
  });

  it("FITNESS_MAP covers all 3 experience levels", () => {
    expect(FITNESS_MAP["beginner"]).toBe("Low");
    expect(FITNESS_MAP["intermediate"]).toBe("Moderate");
    expect(FITNESS_MAP["competitive"]).toBe("High");
  });

  it("OBJECTIVE_MAP covers all 4 problem types", () => {
    const problemIds: ProblemId[] = ["weakness", "tournament", "levelup", "custom"];
    problemIds.forEach((id) => {
      expect(OBJECTIVE_MAP[id], `missing problemId: ${id}`).toBeTruthy();
    });
  });
});

// ─── buildQuestion — weakness ─────────────────────────────────────────────────

describe("buildQuestion — weakness", () => {
  it("full fields produces coherent prompt", () => {
    const q = buildQuestion(
      form({
        sport: "Tennis",
        age: "12",
        gender: "MALE",
        experienceLevel: "competitive",
        weaknessArea: "mental",
        weaknessContext: "matches",
        weaknessAttempts: "coaching",
        weaknessDuration: "months",
        weeklyHours: "4-7",
        budgetRange: "3k-7k",
      }),
      "weakness"
    );
    expect(q).toContain("12-year-old son");
    expect(q).toContain("Tennis");
    expect(q).toContain("competitive");
    expect(q).toContain("mental focus");
    expect(q).toContain("several months");
    expect(q).toContain("matches");
    expect(q).toContain("coach");
    expect(q).toContain("6 hours");
    expect(q).toContain("moderate");
  });

  it("daughter gender label", () => {
    const q = buildQuestion(form({ sport: "Badminton", gender: "FEMALE", age: "10", weaknessArea: "technique" }), "weakness");
    expect(q).toContain("daughter");
  });

  it("unknown gender uses neutral 'child'", () => {
    const q = buildQuestion(form({ sport: "Badminton", gender: null, age: "10", weaknessArea: "technique" }), "weakness");
    expect(q).toContain("child");
    expect(q).not.toContain("son");
    expect(q).not.toContain("daughter");
  });

  it("no double space when age is empty", () => {
    const q = buildQuestion(form({ sport: "Cricket", weaknessArea: "fitness" }), "weakness");
    expect(q).not.toMatch(/My {2}/);
    expect(q).toMatch(/My child/);
  });

  it("no attemps yet produces fallback text", () => {
    const q = buildQuestion(form({ sport: "Cricket", weaknessAttempts: "nothing" }), "weakness");
    expect(q).toContain("nothing yet");
  });

  it("null weaknessAttempts produces fallback 'not yet tried'", () => {
    const q = buildQuestion(form({ sport: "Cricket", weaknessAttempts: null }), "weakness");
    expect(q).toContain("have not yet tried");
  });

  it("unknown weaknessArea falls back gracefully", () => {
    const q = buildQuestion(form({ sport: "Cricket", weaknessArea: "coordination" }), "weakness");
    // Should not throw; should include the raw value or a generic phrase
    expect(q).toBeTruthy();
    expect(q).toContain("coordination");
  });

  it("defaults weeklyHours to 6 when null", () => {
    const q = buildQuestion(form({ sport: "Cricket", weeklyHours: null }), "weakness");
    expect(q).toContain("6 hours");
  });
});

// ─── buildQuestion — tournament ───────────────────────────────────────────────

describe("buildQuestion — tournament", () => {
  it("full fields produces coherent prompt", () => {
    const q = buildQuestion(
      form({
        sport: "Badminton",
        age: "14",
        gender: "FEMALE",
        experienceLevel: "intermediate",
        timeline: "months-1-3",
        tournamentLevel: "state",
        physicalReadiness: "moderate",
        tournamentGap: "nerves",
        weeklyHours: "8-12",
        budgetRange: "7k-15k",
      }),
      "tournament"
    );
    expect(q).toContain("14-year-old daughter");
    expect(q).toContain("Badminton");
    expect(q).toContain("state championship");
    expect(q).toContain("1–3 months");
    expect(q).toContain("nerves");
    expect(q).toContain("10 hours");
    expect(q).toContain("moderate");
  });

  it("timeline 'weeks' maps to '2–4 weeks'", () => {
    const q = buildQuestion(form({ sport: "Tennis", timeline: "weeks" }), "tournament");
    expect(q).toContain("2–4 weeks");
  });

  it("timeline 'months-3-6' maps to '3–6 months'", () => {
    const q = buildQuestion(form({ sport: "Tennis", timeline: "months-3-6" }), "tournament");
    expect(q).toContain("3–6 months");
  });

  it("null timeline falls back gracefully", () => {
    const q = buildQuestion(form({ sport: "Tennis", timeline: null }), "tournament");
    expect(q).toContain("a few months");
  });

  it("no double space when age is empty", () => {
    const q = buildQuestion(form({ sport: "Tennis" }), "tournament");
    expect(q).not.toMatch(/My {2}/);
  });

  it("matchplay gap appears correctly", () => {
    const q = buildQuestion(form({ sport: "Cricket", tournamentGap: "matchplay" }), "tournament");
    expect(q).toContain("match experience");
  });
});

// ─── buildQuestion — levelup ──────────────────────────────────────────────────

describe("buildQuestion — levelup", () => {
  it("full fields produces coherent prompt", () => {
    const q = buildQuestion(
      form({
        sport: "Cricket",
        age: "11",
        gender: "MALE",
        experienceLevel: "beginner",
        currentLevel: "school",
        targetLevel: "district",
        timeAtCurrentLevel: "6-12m",
        trainingType: "academy",
        levelBlocker: "competition",
        topStrength: "physical",
        weeklyHours: "1-3",
        budgetRange: "under-3k",
      }),
      "levelup"
    );
    expect(q).toContain("11-year-old son");
    expect(q).toContain("Cricket");
    expect(q).toContain("school level");
    expect(q).toContain("district level");
    expect(q).toContain("6–12 months");
    expect(q).toContain("formal academy");
    expect(q).toContain("competitive exposure");
    expect(q).toContain("physical athleticism");
    expect(q).toContain("2 hours");
    expect(q).toContain("budget");
  });

  it("mental blocker maps correctly", () => {
    const q = buildQuestion(form({ sport: "Tennis", levelBlocker: "mental" }), "levelup");
    expect(q).toContain("mental game");
  });

  it("no double space when age is empty", () => {
    const q = buildQuestion(form({ sport: "Swimming" }), "levelup");
    expect(q).not.toMatch(/My {2}/);
  });

  it("omits optional sections when null", () => {
    const q = buildQuestion(form({ sport: "Cricket", currentLevel: "club", targetLevel: "state" }), "levelup");
    // timeAtLevel is null → sentence should not appear
    expect(q).not.toContain("They have been at their current level for");
    // training is null → sentence should not appear
    expect(q).not.toContain("Current training setup");
  });
});

// ─── buildQuestion — custom ───────────────────────────────────────────────────

describe("buildQuestion — custom", () => {
  it("full fields produces coherent prompt", () => {
    const q = buildQuestion(
      form({
        sport: "Football",
        age: "13",
        gender: "MALE",
        experienceLevel: "intermediate",
        challengeCategory: "nutrition",
        challenge: "My son is losing weight despite eating well.",
        desiredOutcome: "resources",
      }),
      "custom"
    );
    expect(q).toContain("13-year-old son");
    expect(q).toContain("Football");
    expect(q).toContain("nutrition");
    expect(q).toContain("My son is losing weight");
    expect(q).toContain("resources");
  });

  it("no sport shows fallback without sport line", () => {
    const q = buildQuestion(form({ sport: "", age: "10", challenge: "Feeling burnt out" }), "custom");
    expect(q).not.toContain("plays");
    expect(q).toContain("Feeling burnt out");
  });

  it("no sport and no age uses minimal fallback", () => {
    const q = buildQuestion(form({ sport: "", age: "", challenge: "Some issue" }), "custom");
    expect(q).toContain("My child is involved in sport");
  });

  it("nutrition category label includes burnout", () => {
    const q = buildQuestion(form({ sport: "Tennis", challengeCategory: "nutrition", challenge: "Burnout recovery" }), "custom");
    expect(q).toContain("burnout");
  });

  it("no double space when age is empty", () => {
    const q = buildQuestion(form({ sport: "Tennis", challenge: "some challenge" }), "custom");
    expect(q).not.toMatch(/My {2}/);
  });

  it("null desiredOutcome falls back gracefully", () => {
    const q = buildQuestion(form({ sport: "Tennis", challenge: "some challenge", desiredOutcome: null }), "custom");
    expect(q).toContain("actionable advice");
  });
});

// ─── buildPayload ─────────────────────────────────────────────────────────────

describe("buildPayload", () => {
  it("maps all fields correctly for weakness", () => {
    const payload = buildPayload(
      form({
        sport: "Tennis",
        age: "12",
        gender: "MALE",
        state: "Delhi",
        experienceLevel: "competitive",
        weeklyHours: "4-7",
        budgetRange: "15k-plus",
      }),
      "weakness"
    );
    expect(payload.child_age).toBe(12);
    expect(payload.child_gender).toBe("male");
    expect(payload.current_fitness_level).toBe("High");
    expect(payload.weekly_time_commitment).toBe(6);
    expect(payload.budget_tier).toBe("Premium");
    expect(payload.primary_objective).toBe("Compete");
    expect(payload.sport).toBe("Tennis");
    expect(payload.location).toBe("Delhi");
    expect(typeof payload.parent_specific_question).toBe("string");
    expect(payload.parent_specific_question.length).toBeGreaterThan(20);
  });

  it("maps female gender correctly", () => {
    const payload = buildPayload(form({ sport: "Badminton", age: "10", gender: "FEMALE" }), "weakness");
    expect(payload.child_gender).toBe("female");
  });

  it("null gender defaults to 'male' (known limitation)", () => {
    // This is a known limitation: gender is not yet collected in wizard steps.
    // The test documents current behavior; it should be "neutral" once fixed.
    const payload = buildPayload(form({ sport: "Cricket", gender: null }), "weakness");
    expect(payload.child_gender).toBe("male");
  });

  it("valid integer age passes through", () => {
    const payload = buildPayload(form({ age: "8" }), "weakness");
    expect(payload.child_age).toBe(8);
  });

  it("empty age defaults to 10", () => {
    const payload = buildPayload(form({ age: "" }), "weakness");
    expect(payload.child_age).toBe(10);
  });

  it("non-numeric age string defaults to 10 (no NaN)", () => {
    const payload = buildPayload(form({ age: "abc" }), "weakness");
    expect(payload.child_age).toBe(10);
    expect(Number.isNaN(payload.child_age)).toBe(false);
  });

  it("age below 3 clamps to minimum 3", () => {
    const payload = buildPayload(form({ age: "1" }), "weakness");
    expect(payload.child_age).toBe(3);
  });

  it("age above 25 clamps to maximum 25", () => {
    const payload = buildPayload(form({ age: "30" }), "weakness");
    expect(payload.child_age).toBe(25);
  });

  it("age exactly at boundaries (3 and 25) passes through", () => {
    expect(buildPayload(form({ age: "3" }), "weakness").child_age).toBe(3);
    expect(buildPayload(form({ age: "25" }), "weakness").child_age).toBe(25);
  });

  it("null state produces empty location string", () => {
    const payload = buildPayload(form({ state: null }), "weakness");
    expect(payload.location).toBe("");
  });

  it("state value passes through to location", () => {
    const payload = buildPayload(form({ state: "Maharashtra" }), "weakness");
    expect(payload.location).toBe("Maharashtra");
  });

  it("empty sport defaults to 'General'", () => {
    const payload = buildPayload(form({ sport: "" }), "weakness");
    expect(payload.sport).toBe("General");
  });

  it("objective maps correctly for all 4 problem types", () => {
    expect(buildPayload(form({ sport: "Tennis" }), "weakness").primary_objective).toBe("Compete");
    expect(buildPayload(form({ sport: "Tennis" }), "tournament").primary_objective).toBe("Compete");
    expect(buildPayload(form({ sport: "Tennis" }), "levelup").primary_objective).toBe("Elite");
    expect(buildPayload(form({ sport: "Tennis" }), "custom").primary_objective).toBe("Recreational");
  });

  it("null weeklyHours defaults to 6", () => {
    const payload = buildPayload(form({ weeklyHours: null }), "weakness");
    expect(payload.weekly_time_commitment).toBe(6);
  });

  it("null budgetRange defaults to Moderate", () => {
    const payload = buildPayload(form({ budgetRange: null }), "weakness");
    expect(payload.budget_tier).toBe("Moderate");
  });

  it("null experienceLevel defaults to Moderate fitness", () => {
    const payload = buildPayload(form({ experienceLevel: null }), "weakness");
    expect(payload.current_fitness_level).toBe("Moderate");
  });

  it("personality_tags is always an array", () => {
    const payload = buildPayload(form(), "custom");
    expect(Array.isArray(payload.personality_tags)).toBe(true);
  });

  it("parent_specific_question is a non-empty string", () => {
    const payload = buildPayload(form({ sport: "Cricket", challenge: "test question" }), "custom");
    expect(typeof payload.parent_specific_question).toBe("string");
    expect(payload.parent_specific_question.length).toBeGreaterThan(10);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("completely empty form does not throw for any problem type", () => {
    const problems: ProblemId[] = ["weakness", "tournament", "levelup", "custom"];
    problems.forEach((p) => {
      expect(() => buildQuestion(EMPTY_FORM, p)).not.toThrow();
      expect(() => buildPayload(EMPTY_FORM, p)).not.toThrow();
    });
  });

  it("buildQuestion returns a string for unknown problemId", () => {
    // @ts-expect-error testing unknown id
    const q = buildQuestion(form(), "unknown");
    expect(typeof q).toBe("string");
    expect(q.length).toBeGreaterThan(0);
  });

  it("float age (e.g. '12.5') passes through as-is when valid", () => {
    const payload = buildPayload(form({ age: "12.5" }), "weakness");
    expect(payload.child_age).toBe(12.5);
  });

  it("buildQuestion does not produce consecutive spaces anywhere", () => {
    const problems: ProblemId[] = ["weakness", "tournament", "levelup", "custom"];
    problems.forEach((p) => {
      const q = buildQuestion(form({ challenge: "test" }), p);
      expect(q, `double space in ${p}`).not.toMatch(/  /);
    });
  });

  it("buildQuestion uses 'their chosen sport' when sport is empty", () => {
    const q = buildQuestion(form({ sport: "", weaknessArea: "technique" }), "weakness");
    expect(q).toContain("their chosen sport");
  });
});
