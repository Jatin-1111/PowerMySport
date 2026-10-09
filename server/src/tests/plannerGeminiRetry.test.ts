process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { isRetryable } = require("../client/services/plannerRecommendations/gemini");

describe("which model failures move on to the next model", () => {
  it("includes Google's busy answer, which used to end the call at the first model", () => {
    const busy =
      '{"error":{"code":503,"message":"this model is currently experiencing high demand.","status":"unavailable"}}';
    assert.equal(isRetryable(busy), true);
  });

  it("still includes quota, a missing model and a bad JSON answer", () => {
    for (const message of ["429 you exceeded your current quota", "404 not found", "bad json"]) {
      assert.equal(isRetryable(message), true, message);
    }
  });

  it("does not hide a real mistake of ours", () => {
    assert.equal(isRetryable("400 invalid argument: bad schema"), false);
  });
});
