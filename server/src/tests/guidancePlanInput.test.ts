// Turning a child's profile into a plan request. Pure and offline: no database, no model, no
// network. The tables are also checked against the website's own copy so the two cannot drift.
import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");
const { describe, it } = require("node:test");

const {
  BUDGET_BY_RANGE,
  DEFAULTS,
  FITNESS_BY_EXPERIENCE,
  HOURS_BY_CATEGORY,
  OBJECTIVE_BY_AMBITION,
  buildPlanInput,
} = require("../client/services/guidancePlanInput");
const { guidanceRequestSchema } = require("../shared/services/guidanceAiService");
const shared = require("@powermysport/shared-types");

const NOW = new Date("2026-10-22T10:00:00Z");

/** A child with everything the plan needs. */
const full = (over: Record<string, unknown> = {}) => ({
  id: "child-1",
  dob: new Date("2012-12-01T00:00:00Z"),
  gender: "MALE",
  sportsFocus: ["Tennis"],
  chosenSport: "Tennis",
  yearsPlaying: 3,
  location: "Delhi",
  ambition: "competitive",
  experienceLevel: "intermediate",
  weeklyHoursCategory: "4-7",
  budgetRange: "7k-15k",
  ...over,
});

const build = (profile: Record<string, unknown>, answers: Record<string, unknown> = {}) =>
  buildPlanInput(profile, answers, NOW);

const fields = (result: { missing: Array<{ field: string }> }) =>
  result.missing.map((m: { field: string }) => m.field);

describe("a child with a full profile", () => {
  it("makes a complete request that the plan generator accepts, and asks nothing", () => {
    const result = build(full());
    assert.equal(result.complete, true);
    assert.deepEqual(result.request, {
      child_age: 13,
      child_gender: "male",
      current_fitness_level: "Moderate",
      personality_tags: [],
      primary_objective: "Compete",
      weekly_time_commitment: 6,
      budget_tier: "Moderate",
      sport: "Tennis",
      plan_horizon: "journey",
      dependent_id: "child-1",
      location: "Delhi",
      years_playing: 3,
    });
    assert.deepEqual(result.assumptions, []);
    assert.equal(guidanceRequestSchema.safeParse(result.request).success, true);
  });

  it("carries the parent's own words as the question, and lets the model shape the plan around it", () => {
    const result = build(full(), { question: "He gets nervous before matches" });
    assert.equal(result.request.parent_specific_question, "He gets nervous before matches");
    assert.equal(result.request.plan_horizon, "auto");
  });

  it("sends nothing that could identify the child: no name, no date of birth", () => {
    const result = build(full({ name: "Vikrant Khandelwal" }));
    const text = JSON.stringify(result.request);
    assert.ok(!text.includes("Vikrant"));
    assert.ok(!text.includes("2012"));
  });
});

describe("what is asked", () => {
  it("asks for a boy or a girl when the profile says other or nothing", () => {
    for (const gender of ["OTHER", undefined]) {
      const result = build(full({ gender }));
      assert.equal(result.complete, false);
      assert.deepEqual(fields(result), ["gender"]);
      assert.deepEqual(result.missing[0].options, ["boy", "girl"]);
      assert.equal(result.missing[0].optional, false);
    }
  });

  it("uses the parent's answer for gender", () => {
    const result = build(full({ gender: undefined }), { gender: "female" });
    assert.equal(result.complete, true);
    assert.equal(result.request.child_gender, "female");
  });

  it("asks for the age when there is no date of birth and no age, or it is not a child's", () => {
    for (const profile of [
      full({ dob: undefined, age: undefined }),
      full({ dob: undefined, age: 2 }),
      full({ dob: undefined, age: 30 }),
    ]) {
      const result = build(profile);
      assert.equal(result.complete, false);
      assert.deepEqual(fields(result), ["age"]);
    }
  });

  it("works out the age from the date of birth, and from a stored age when there is none", () => {
    assert.equal(build(full()).request.child_age, 13);
    assert.equal(build(full({ dob: undefined, age: 9 })).request.child_age, 9);
  });

  it("asks the soft questions when the profile lacks them, and marks them optional", () => {
    const result = build(
      full({ ambition: undefined, experienceLevel: undefined, weeklyHoursCategory: undefined })
    );
    assert.equal(result.complete, false);
    assert.deepEqual(fields(result), ["ambition", "experience", "weeklyHours"]);
    assert.ok(result.missing.every((m: { optional: boolean }) => m.optional));
  });

  it("uses the website's defaults, and says so, when the parent skips the soft questions", () => {
    const result = build(
      full({ ambition: undefined, experienceLevel: undefined, weeklyHoursCategory: undefined }),
      { useDefaults: true }
    );
    assert.equal(result.complete, true);
    assert.equal(result.request.primary_objective, DEFAULTS.objective);
    assert.equal(result.request.current_fitness_level, DEFAULTS.fitness);
    assert.equal(result.request.weekly_time_commitment, DEFAULTS.hours);
    assert.deepEqual(result.assumptions, [
      "a general fitness goal",
      "an intermediate level",
      "6 hours a week",
    ]);
  });

  it("still asks the hard questions when the parent skips the soft ones", () => {
    const result = build(full({ gender: undefined }), { useDefaults: true });
    assert.equal(result.complete, false);
    assert.deepEqual(fields(result), ["gender"]);
  });

  it("assumes a moderate budget when none is set, and says so, without asking", () => {
    const result = build(full({ budgetRange: undefined }));
    assert.equal(result.complete, true);
    assert.equal(result.request.budget_tier, "Moderate");
    assert.deepEqual(result.assumptions, ["a moderate budget"]);
  });

  it("takes hours, ambition and experience from the parent's answers when the profile has none", () => {
    const result = build(
      full({ ambition: undefined, experienceLevel: undefined, weeklyHoursCategory: undefined }),
      { ambition: "national", experienceLevel: "competitive", weeklyHours: 12 }
    );
    assert.equal(result.complete, true);
    assert.equal(result.request.primary_objective, "Elite");
    assert.equal(result.request.current_fitness_level, "High");
    assert.equal(result.request.weekly_time_commitment, 12);
  });

  it("ignores hours that are not a possible week", () => {
    for (const weeklyHours of [-1, 41, 1000]) {
      const result = build(full({ weeklyHoursCategory: undefined }), { weeklyHours });
      assert.equal(result.complete, false, String(weeklyHours));
      assert.deepEqual(fields(result), ["weeklyHours"]);
    }
  });
});

describe("which sport", () => {
  it("uses the sport the family committed to over the ones in focus", () => {
    const result = build(full({ chosenSport: "Badminton", sportsFocus: ["Tennis", "Badminton"] }));
    assert.equal(result.request.sport, "Badminton");
  });

  it("uses the only sport in focus when none is committed to", () => {
    const result = build(full({ chosenSport: undefined, sportsFocus: ["Chess"] }));
    assert.equal(result.request.sport, "Chess");
  });

  it("asks which when several are in focus and none is committed to, offering those", () => {
    const result = build(full({ chosenSport: undefined, sportsFocus: ["Tennis", "Cricket"] }));
    assert.equal(result.complete, false);
    assert.deepEqual(fields(result), ["sport"]);
    assert.deepEqual(result.missing[0].options, ["Tennis", "Cricket"]);
  });

  it("asks with the sports we cover when the child has no sport at all", () => {
    const result = build(full({ chosenSport: undefined, sportsFocus: [] }));
    assert.deepEqual(fields(result), ["sport"]);
    assert.ok(result.missing[0].options.includes("Table Tennis"));
    assert.equal(result.missing[0].options.length, 10);
  });

  it("lets the parent's named sport win, in any spelling, as the canonical name", () => {
    for (const named of ["badminton", "BADMINTON", " Badminton "]) {
      assert.equal(build(full(), { sport: named }).request.sport, "Badminton");
    }
    assert.equal(
      build(full({ chosenSport: undefined, sportsFocus: [] }), { sport: "table-tennis" }).request
        .sport,
      "Table Tennis"
    );
  });

  it("says plainly when the sport is one we do not cover, and offers the ones we do", () => {
    const result = build(full({ chosenSport: "Curling", sportsFocus: ["Curling"] }));
    assert.equal(result.complete, false);
    assert.match(result.missing[0].ask, /do not make plans for Curling yet/);
    assert.equal(result.missing[0].options.length, 10);
  });
});

describe("what the parent types", () => {
  it("cuts the question down to plain text, with no links or markup", () => {
    const result = build(full(), {
      question: "He is\nnervous <script>alert(1)</script> see https://evil.example/x   please",
    });
    const question = result.request.parent_specific_question;
    assert.ok(!question.includes("evil.example"));
    assert.ok(!question.includes("<"));
    assert.ok(!question.includes("\n"));
  });

  it("keeps a long question to 300 characters", () => {
    const result = build(full(), { question: "word ".repeat(200) });
    assert.ok(result.request.parent_specific_question.length <= 300);
  });

  it("drops a question that is only symbols", () => {
    const result = build(full(), { question: "<>{}" });
    assert.equal(result.request.parent_specific_question, undefined);
    assert.equal(result.request.plan_horizon, "journey");
  });
});

describe("the tables", () => {
  it("map every value of the shared child vocabulary", () => {
    for (const level of shared.CHILD_EXPERIENCE_LEVELS)
      assert.ok(FITNESS_BY_EXPERIENCE[level], level);
    for (const hours of shared.CHILD_WEEKLY_HOURS) assert.ok(HOURS_BY_CATEGORY[hours] > 0, hours);
    for (const range of shared.CHILD_BUDGET_RANGES) assert.ok(BUDGET_BY_RANGE[range], range);
    for (const ambition of shared.CHILD_AMBITIONS)
      assert.ok(OBJECTIVE_BY_AMBITION[ambition], ambition);
  });

  it("match the website's own tables exactly", () => {
    const root = path.resolve(__dirname, "../../..");
    const file = path.join(root, "client/src/modules/guidance/config/wizard/guidanceUtils.ts");
    const source = fs.readFileSync(file, "utf8");

    /** The object literal that follows `export const NAME ... = `, read as data. */
    const read = (name: string): Record<string, unknown> => {
      const match = source.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[^}]*\\})`));
      assert.ok(match, `${name} was not found in the website's guidanceUtils.ts`);
      return new Function(`return (${match![1]});`)();
    };

    assert.deepEqual(FITNESS_BY_EXPERIENCE, read("FITNESS_MAP"));
    assert.deepEqual(HOURS_BY_CATEGORY, read("HOURS_MAP"));
    assert.deepEqual(BUDGET_BY_RANGE, read("BUDGET_MAP"));
  });
});
