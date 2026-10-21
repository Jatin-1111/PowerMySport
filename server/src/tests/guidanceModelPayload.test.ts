import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

const { guidanceModelContents } = require("../shared/services/guidanceAiService");

const request = {
  child_age: 11,
  child_gender: "female",
  current_fitness_level: "Moderate",
  personality_tags: ["focused"],
  primary_objective: "Compete",
  weekly_time_commitment: 6,
  budget_tier: "Moderate",
  sport: "Tennis",
  location: "Delhi",
  dependent_id: "64b7f0c2a1b2c3d4e5f60718",
};

describe("what the guidance model is sent", () => {
  it("leaves out the child's profile id", () => {
    const sent = guidanceModelContents(request);
    assert.equal(sent.includes("dependent_id"), false);
    assert.equal(sent.includes(request.dependent_id), false);
  });

  it("keeps everything the plan is built from", () => {
    const sent = JSON.parse(guidanceModelContents(request));
    assert.equal(sent.child_age, 11);
    assert.equal(sent.sport, "Tennis");
    assert.equal(sent.location, "Delhi");
    assert.deepEqual(sent.personality_tags, ["focused"]);
  });

  it("does not change the request it is given", () => {
    guidanceModelContents(request);
    assert.equal(request.dependent_id, "64b7f0c2a1b2c3d4e5f60718");
  });
});
