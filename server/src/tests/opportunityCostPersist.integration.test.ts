/* eslint-disable @typescript-eslint/no-var-requires */
// The cost and the one-line who-can-apply must survive a save, and must reach a
// parent through the public read. A field the model does not know is dropped
// silently by Mongoose, which is the failure this guards.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Opportunity } = require("../shared/models/Opportunity");
const { getOpportunity } = require("../shared/controller/opportunityController");

let memoryServer: { getUri(): string; stop(): Promise<void> };

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Opportunity.deleteMany({});
});

const seed = (over: Record<string, unknown> = {}) =>
  Opportunity.create({
    slug: "ikf",
    track: "admission",
    category: "academy",
    title: "India Khelo Football",
    status: "published",
    ...over,
  });

const readPublic = async (slug: string) => {
  let body: { data?: Record<string, any> } | undefined;
  let error: unknown;
  const res = {
    status() {
      return res;
    },
    json(value: typeof body) {
      body = value;
      return res;
    },
  };
  await new Promise<void>((resolve) => {
    const result = getOpportunity({ params: { slug } }, res, (err?: unknown) => {
      error = err;
      resolve();
    }) as Promise<void>;
    Promise.resolve(result).then(() => resolve());
  });
  return { body, error };
};

describe("cost and who-can-apply", () => {
  it("are stored and come back through the public read", async () => {
    await seed({
      cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
      eligibility: { summary: "Aspiring footballers", gender: "any" },
    });
    const { body, error } = await readPublic("ikf");
    assert.equal(error, undefined);
    assert.deepEqual(body?.data?.cost, {
      kind: "fee",
      amount: 125,
      currency: "INR",
      note: "City round",
    });
    assert.equal(body?.data?.eligibility.summary, "Aspiring footballers");
  });

  it("leave an entry that states neither exactly as it was, with no cost at all", async () => {
    await seed();
    const { body } = await readPublic("ikf");
    assert.equal(body?.data?.cost, undefined);
    assert.equal(body?.data?.eligibility?.summary, undefined);
  });

  it("refuse a cost kind outside the list at the model", async () => {
    await assert.rejects(() => seed({ cost: { kind: "cheap" } }), /kind/);
  });
});
