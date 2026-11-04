// The sport filter on the booking pages: the supported sports always, plus any
// other directory sport a listed provider really offers. Nothing else.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { SUPPORTED_SPORTS } = require("../shared/constants/supportedSports");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["sports", "venues", "coaches", "experts", "academies"]) {
    await col(name).deleteMany({});
  }
  await col("sports").insertMany(
    ["Archery", "Kabaddi", "Squash", "Tennis"].map((name) => ({
      name,
      slug: name.toLowerCase(),
      isVerified: true,
    }))
  );
});

const list = async (): Promise<string[]> => {
  const response = await request(app).get("/api/sports/discovery");
  assert.equal(response.status, 200);
  return response.body.data.map((s: { name: string }) => s.name);
};

const SUPPORTED = SUPPORTED_SPORTS.map((s: { name: string }) => s.name).sort();

describe("GET /api/sports/discovery", () => {
  it("is the supported sports when no listed provider uses anything else", async () => {
    assert.deepEqual(await list(), SUPPORTED);
  });

  it("adds a directory sport that a listed provider offers", async () => {
    await col("venues").insertOne({ _id: oid(), approvalStatus: "APPROVED", sports: ["Archery"] });
    await col("experts").insertOne({ _id: oid(), isActive: true, sports: ["squash"] });
    assert.deepEqual(await list(), [...SUPPORTED, "Archery", "Squash"].sort());
  });

  it("ignores sports only on unlisted providers, and free text outside the directory", async () => {
    await col("venues").insertOne({ _id: oid(), approvalStatus: "PENDING", sports: ["Kabaddi"] });
    await col("coaches").insertOne({
      _id: oid(),
      verificationStatus: "VERIFIED",
      isVerified: true,
      sports: ["General Fitness / Athletic Performance"],
    });
    await col("academies").insertOne({
      _id: oid(),
      isApproved: true,
      kycVerified: true,
      isActive: false,
      sports: ["Kabaddi"],
    });
    assert.deepEqual(await list(), SUPPORTED);
  });

  it("never lists a sport twice", async () => {
    await col("venues").insertOne({ _id: oid(), approvalStatus: "APPROVED", sports: ["tennis"] });
    const names = await list();
    assert.equal(names.filter((n) => n === "Tennis").length, 1);
  });
});
