/* eslint-disable @typescript-eslint/no-var-requires */
// What each audience is shown of a child.
//
// The parent's view has its own guard (childProfileView.test.ts). This covers the other two
// audiences, so a field added to the model is shown to experts, or sent to strangers in the
// community, only by a decision someone wrote down.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, describe, it } = require("node:test");

const {
  summarizePlayerForExpert,
  serializeFullPlayerForExpert,
  EXPERT_BRIEFING_WITHHOLDS,
  EXPERT_FULL_PROFILE_WITHHOLDS,
} = require("../client/services/ExpertsService/shared");
const { DEPENDENT_FIELDS } = require("../community/services/dependentSummary");
const { Player } = require("../client/models/Player");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

/** Every top-level field of a Player, with the quiz answers as `quiz.<name>`. */
const modelFields = (): string[] => {
  const fields: string[] = [];
  for (const path of Object.keys(Player.schema.paths)) {
    if (path === "__v" || path === "_id" || path.startsWith("quiz.")) continue;
    if (path === "quiz") {
      for (const sub of Object.keys(Player.schema.path("quiz").schema.paths)) {
        fields.push(`quiz.${sub}`);
      }
    } else if (!path.includes(".")) {
      fields.push(path);
    }
  }
  return fields;
};

/** A child with every field filled, so every field a serializer can show is present. */
const fullChild = () => {
  const child: Record<string, any> = { _id: "c1", quiz: {} };
  for (const field of modelFields()) {
    if (field.startsWith("quiz.")) child.quiz[field.slice(5)] = 1;
    else child[field] = field === "dob" ? new Date("2015-06-01") : "x";
  }
  child.sportsFocus = ["Tennis"];
  child.sportMatches = [{ sport: "Tennis", fitLabel: "Great", score: 90 }];
  child.consideringSports = ["Tennis"];
  child.personalityTags = ["calm"];
  child.wizardCompletedAt = new Date();
  return child;
};

/** The field names an expert-facing serializer shows, with the quiz answers as `quiz.<name>`. */
const shownBy = (output: Record<string, unknown>, aliases: Record<string, string> = {}) => {
  const shown = new Set<string>();
  for (const key of Object.keys(output)) shown.add(key);
  for (const [field, alias] of Object.entries(aliases)) if (alias in output) shown.add(field);
  return shown;
};

const quizNames = () => Object.keys(Player.schema.path("quiz").schema.paths);

const unaccounted = (shown: Set<string>, withheld: Record<string, string>): string[] =>
  modelFields().filter((field) => {
    if (field.startsWith("quiz.")) {
      return !shown.has(field.slice(5)) && !withheld[field];
    }
    return !shown.has(field) && !withheld[field];
  });

describe("what an expert sees of a child", () => {
  it("the briefing shows, or deliberately withholds, every field the model stores", () => {
    const output = summarizePlayerForExpert(fullChild());
    // The briefing shows the single best match, under its own name.
    const shown = shownBy(output, { sportMatches: "topSportMatch" });

    const missing = unaccounted(shown, EXPERT_BRIEFING_WITHHOLDS);

    assert.deepEqual(
      missing,
      [],
      `Player stores ${missing.join(", ")} but the expert briefing neither shows it nor lists it in EXPERT_BRIEFING_WITHHOLDS`
    );
  });

  it("the full profile shows, or deliberately withholds, every field the model stores", () => {
    const shown = shownBy(serializeFullPlayerForExpert(fullChild()));

    const missing = unaccounted(shown, EXPERT_FULL_PROFILE_WITHHOLDS);

    assert.deepEqual(
      missing,
      [],
      `Player stores ${missing.join(", ")} but the expert's full profile neither shows it nor lists it in EXPERT_FULL_PROFILE_WITHHOLDS`
    );
  });

  it("never lists a withheld field that the same tier also shows", () => {
    const briefing = shownBy(summarizePlayerForExpert(fullChild()), {
      sportMatches: "topSportMatch",
    });
    const full = shownBy(serializeFullPlayerForExpert(fullChild()));
    const both = (shown: Set<string>, withheld: Record<string, string>) =>
      Object.keys(withheld).filter((f) => shown.has(f.startsWith("quiz.") ? f.slice(5) : f));

    assert.deepEqual(both(briefing, EXPERT_BRIEFING_WITHHOLDS), []);
    assert.deepEqual(both(full, EXPERT_FULL_PROFILE_WITHHOLDS), []);
  });

  it("only withholds fields the model has", () => {
    const real = new Set(modelFields());
    for (const withheld of [EXPERT_BRIEFING_WITHHOLDS, EXPERT_FULL_PROFILE_WITHHOLDS]) {
      assert.deepEqual(
        Object.keys(withheld).filter((f) => !real.has(f)),
        []
      );
    }
  });

  it("the briefing is a strict subset of what the full profile shows", () => {
    const briefing = Object.keys(summarizePlayerForExpert(fullChild())).filter(
      (k) => k !== "_id" && k !== "topSportMatch"
    );
    const full = new Set(Object.keys(serializeFullPlayerForExpert(fullChild())));

    assert.deepEqual(
      briefing.filter((k) => !full.has(k)),
      [],
      "the briefing shows something the paid-session profile does not"
    );
  });

  it("neither tier shows the owner's id or the date of birth in the briefing", () => {
    const briefing = summarizePlayerForExpert(fullChild());
    assert.equal("userId" in briefing, false);
    assert.equal("dob" in briefing, false);
    assert.equal("userId" in serializeFullPlayerForExpert(fullChild()), false);
  });

  it("the scan covers every quiz answer, so a new one cannot slip through", () => {
    assert.ok(quizNames().length >= 16);
    assert.ok(modelFields().includes("quiz.heightCm"));
  });
});

describe("what the community can see of a child", () => {
  it("reads only the fields that make an age band, a sport, a gender and a city", () => {
    const read = DEPENDENT_FIELDS.split(/\s+/).sort();

    assert.deepEqual(read, [
      "age",
      "chosenSport",
      "dob",
      "gender",
      "location",
      "sportsFocus",
      "userId",
    ]);
  });

  it("never reads the name, the relation or anything about the quiz", () => {
    const read = DEPENDENT_FIELDS.split(/\s+/);
    for (const forbidden of ["name", "relation", "quiz", "personalityTags", "sportMatches"]) {
      assert.equal(read.includes(forbidden), false, `${forbidden} is read for the community`);
    }
  });
});
