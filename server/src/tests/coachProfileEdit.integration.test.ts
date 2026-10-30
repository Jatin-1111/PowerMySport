// A coach editing their own profile may change profile fields only. Verification,
// rating and ownership are set elsewhere; this route used to assign whatever the
// request body carried.
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
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Coach } = require("../client/models/Coach");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

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
  for (const name of ["users", "coaches"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const insertCoach = async () => {
  const userId = oid();
  const email = `${userId.toString()}@example.test`;
  await User.collection.insertOne({
    _id: userId,
    name: "Coach Edit",
    email,
    phone: `9${userId.toString().slice(-9)}`,
    role: "Coach",
    isActive: true,
    status: "ACTIVE",
  });
  const coachId = oid();
  await Coach.collection.insertOne({
    _id: coachId,
    userId,
    bio: "Original bio",
    certifications: [],
    sports: ["Tennis"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    availability: [],
    verificationStatus: "UNVERIFIED",
    isVerified: false,
    rating: 0,
    reviewCount: 0,
    subscriptionStatus: "NONE",
    payoutMethods: [],
  });
  const token = generateToken({ id: userId.toString(), email, role: "Coach" });
  return { userId, coachId, token };
};

describe("PUT /api/coaches/:coachId", () => {
  it("applies profile fields", async () => {
    const { coachId, token } = await insertCoach();
    const response = await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "New bio", hourlyRate: 700 });

    assert.equal(response.status, 200);
    const stored = await Coach.collection.findOne({ _id: coachId });
    assert.equal(stored.bio, "New bio");
    assert.equal(stored.hourlyRate, 700);
  });

  it("ignores verification, rating, subscription and ownership fields", async () => {
    const { userId, coachId, token } = await insertCoach();
    const otherUser = oid();
    const response = await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        bio: "Changed",
        isVerified: true,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date().toISOString(),
        rating: 5,
        reviewCount: 200,
        subscriptionStatus: "ACTIVE",
        userId: otherUser.toString(),
        payoutMethods: [{ type: "UPI", upiId: "attacker@upi", isDefault: true }],
      });

    assert.equal(response.status, 200);
    const stored = await Coach.collection.findOne({ _id: coachId });
    assert.equal(stored.bio, "Changed");
    assert.equal(stored.isVerified, false);
    assert.equal(stored.verificationStatus, "UNVERIFIED");
    assert.equal(stored.verifiedAt ?? null, null);
    assert.equal(stored.rating, 0);
    assert.equal(stored.reviewCount, 0);
    assert.equal(stored.subscriptionStatus, "NONE");
    assert.equal(String(stored.userId), userId.toString());
    assert.deepEqual(stored.payoutMethods, []);
  });

  it("still refuses another coach's profile", async () => {
    const mine = await insertCoach();
    const theirs = await insertCoach();
    const response = await request(app)
      .put(`/api/coaches/${theirs.coachId.toString()}`)
      .set("Authorization", `Bearer ${mine.token}`)
      .send({ bio: "Hijack" });

    assert.equal(response.status, 403);
  });
});
