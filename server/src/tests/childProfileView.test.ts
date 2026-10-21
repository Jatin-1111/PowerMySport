/* eslint-disable @typescript-eslint/no-var-requires */
// What a parent is shown of their own child.
//
// The profile and the players list used to be two hand-written field lists. The profile
// one lost `currentStandingTier`, so a child whose level the parent had named never
// showed as assessed, and nothing noticed. These tests make that kind of drift fail.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, describe, it } = require("node:test");

const {
  serializeChildForParent,
  NOT_SENT_TO_THE_PARENT,
} = require("../shared/services/AuthService/childProfile");
const { Player } = require("../client/models/Player");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

/** Top-level stored fields of a Player, without mongoose's own bookkeeping and sub-paths. */
const storedFields = (): string[] =>
  Object.keys(Player.schema.paths)
    .filter((path) => !path.includes(".") && path !== "_id" && path !== "__v")
    .concat("_id");

describe("what a parent sees of their child", () => {
  it("returns, or deliberately withholds, every field the model stores", () => {
    const sent = new Set(Object.keys(serializeChildForParent({ _id: "c1" })));
    const withheld = new Set(Object.keys(NOT_SENT_TO_THE_PARENT));

    const forgotten = storedFields().filter((f) => !sent.has(f) && !withheld.has(f));

    assert.deepEqual(
      forgotten,
      [],
      `Player stores ${forgotten.join(", ")} but the parent's view neither returns it nor lists it in NOT_SENT_TO_THE_PARENT`
    );
  });

  it("does not list a withheld field that is also returned", () => {
    const sent = Object.keys(serializeChildForParent({ _id: "c1" }));
    const both = Object.keys(NOT_SENT_TO_THE_PARENT).filter((f) => sent.includes(f));
    assert.deepEqual(both, []);
  });

  it("only withholds fields the model actually has", () => {
    const stored = new Set(storedFields());
    const stale = Object.keys(NOT_SENT_TO_THE_PARENT).filter((f) => !stored.has(f));
    assert.deepEqual(stale, []);
  });

  it("returns the level a parent named, so the child counts as assessed", () => {
    const view = serializeChildForParent({
      _id: "c1",
      name: "Riya",
      currentStandingTier: "district",
      experienceLevel: "intermediate",
    });
    assert.equal(view.currentStandingTier, "district");
    assert.equal(view.experienceLevel, "intermediate");
  });

  it("derives the age from the date of birth", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 10);
    assert.equal(serializeChildForParent({ _id: "c1", dob }).age, 10);
  });

  it("never exposes the owner's id", () => {
    const view = serializeChildForParent({ _id: "c1", userId: "parent-1", name: "Riya" });
    assert.equal("userId" in view, false);
  });

  it("copes with a child that has only a name", () => {
    const view = serializeChildForParent({ _id: "c1", name: "Riya" });
    assert.deepEqual(view.sportsFocus, []);
    assert.deepEqual(view.sportMatches, []);
    assert.equal(view.quiz, undefined);
  });
});
