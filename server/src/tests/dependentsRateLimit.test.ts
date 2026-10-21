/* eslint-disable @typescript-eslint/no-var-requires */
// The limiter on adding, editing and deleting a child. The real one is backed by
// Redis and fails open, which is exactly the test setup, so these tests build the
// same limiter around an in-memory store to see it actually trip.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, describe, it } = require("node:test");
const express = require("express");
const request = require("supertest");
const { MemoryStore } = require("express-rate-limit");
const { createDependentsWriteRateLimiter } = require("../middleware/rateLimit");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

/** A tiny app: a stand-in for authMiddleware sets the user, then the limiter, then a 200. */
const appFor = () => {
  const app = express();
  app.use((req: any, _res: any, next: any) => {
    const id = req.get("x-user");
    if (id) req.user = { id };
    next();
  });
  app.post(
    "/dependents",
    createDependentsWriteRateLimiter(new MemoryStore()),
    (_req: any, res: any) => res.status(201).json({ success: true })
  );
  return app;
};

describe("the dependents write limiter", () => {
  it("lets normal use through", async () => {
    const app = appFor();
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post("/dependents").set("x-user", "parent-a");
      assert.equal(res.status, 201);
    }
  });

  it("stops one parent after 60 writes with a 429 and a plain message", async () => {
    const app = appFor();
    for (let i = 0; i < 60; i += 1) {
      const res = await request(app).post("/dependents").set("x-user", "parent-a");
      assert.equal(res.status, 201);
    }
    const blocked = await request(app).post("/dependents").set("x-user", "parent-a");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
    assert.match(blocked.body.message, /try again/i);
  });

  it("counts each parent separately, so one family cannot throttle another", async () => {
    const app = appFor();
    for (let i = 0; i < 61; i += 1)
      await request(app).post("/dependents").set("x-user", "parent-a");

    const other = await request(app).post("/dependents").set("x-user", "parent-b");
    assert.equal(other.status, 201);
  });

  it("keys by the signed-in user even when many parents share one address", async () => {
    const app = appFor();
    for (let i = 0; i < 61; i += 1) {
      await request(app)
        .post("/dependents")
        .set("x-user", "parent-a")
        .set("x-forwarded-for", "10.0.0.1");
    }
    const sameAddress = await request(app)
      .post("/dependents")
      .set("x-user", "parent-c")
      .set("x-forwarded-for", "10.0.0.1");
    assert.equal(sameAddress.status, 201);
  });
});
