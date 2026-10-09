process.env.REDIS_ENABLED = "false";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { redisStore } = require("../client/services/plannerRecommendations/RecommendationService");

describe("saved suggestions with Redis off", () => {
  it("are kept in this process, so a re-read after adding an event still finds them", async () => {
    const answer = { inputHash: "h", result: { items: [] } };
    await redisStore.set("planner:rec:u:d", answer, 60);
    assert.deepEqual(await redisStore.get("planner:rec:u:d"), answer);
  });

  it("expire", async () => {
    await redisStore.set("planner:rec:u:gone", { inputHash: "h", result: { items: [] } }, -1);
    assert.equal(await redisStore.get("planner:rec:u:gone"), null);
  });
});
