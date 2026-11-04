/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for GET /api/community/reputation.
//
// This endpoint used to `ensureProfile` and then upsert the reputation row —
// two writes on a GET. That was tolerable while only the community app called
// it once per visit; it stopped being tolerable when the dashboard started
// reading it on every page load, which would have meant a database write every
// time anyone opened their dashboard, and a community profile materialised for
// users who had never opted into the community.
//
// The guarantee these tests pin is therefore not "the numbers are right" (they
// were right before) but "reading does not write". That is invisible in a
// response body, so it is asserted against the collections directly — which is
// the only way this regression would ever be caught.
//
// COMMUNITY_ALLOWED_ROLES (communityShared.ts) is `["Parent"]`, so the role gate
// is part of the contract too: dropping the write must not drop the gate.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { CommunityReputation } = require("../community/models/CommunityReputation");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let userCounter = 0;

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
  for (const name of ["users", "communityprofiles", "communityreputations"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** A real user row plus a real signed token — the same pair a login produces. */
const signedInAs = async (role: string) => {
  const userId = oid();
  userCounter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role} ${userCounter}`,
    email: `${userId.toString()}@example.test`,
    // `phone` carries a non-sparse unique index — every seeded user needs a
    // distinct value or inserts collide once the index has finished building.
    phone: `9${userId.toString().slice(-9)}`,
    role,
    isActive: true,
    status: "ACTIVE",
  });

  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role,
  });

  return { userId, token };
};

const getReputation = (token: string) =>
  request(app).get("/api/community/reputation").set("Authorization", `Bearer ${token}`);

const countIn = async (collection: string) =>
  mongoose.connection.db.collection(collection).countDocuments({});

describe("GET /api/community/reputation", () => {
  it("returns zeroes for a parent who has never contributed", async () => {
    const { token } = await signedInAs("Parent");

    const response = await getReputation(token);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.totalPoints, 0);
    assert.equal(response.body.data.questionCount, 0);
    assert.equal(response.body.data.answerCount, 0);
    assert.equal(response.body.data.receivedUpvotes, 0);
  });

  // The regression this whole file exists for.
  it("writes nothing — no reputation row, no community profile", async () => {
    const { token } = await signedInAs("Parent");

    await getReputation(token);
    await getReputation(token);

    assert.equal(
      await countIn("communityreputations"),
      0,
      "reading reputation must not create a reputation row"
    );
    assert.equal(
      await countIn("communityprofiles"),
      0,
      "reading reputation must not create a community profile"
    );
  });

  it("reports the real counters when a reputation row exists", async () => {
    const { userId, token } = await signedInAs("Parent");
    await CommunityReputation.create({
      userId,
      totalPoints: 23,
      questionCount: 2,
      answerCount: 1,
      receivedUpvotes: 4,
    });

    const response = await getReputation(token);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.totalPoints, 23);
    assert.equal(response.body.data.questionCount, 2);
    assert.equal(response.body.data.answerCount, 1);
    assert.equal(response.body.data.receivedUpvotes, 4);
    // Reading an existing row must not duplicate it either.
    assert.equal(await countIn("communityreputations"), 1);
  });

  // Dropping the write must not drop the authorization that came with it:
  // `ensureProfile` was carrying the role check via `ensureCommunityUser`.
  it("still refuses a non-parent account", async () => {
    const { token } = await signedInAs("Coach");

    const response = await getReputation(token);

    assert.ok(
      response.status >= 400,
      `expected a client error for a Coach, got ${response.status}`
    );
    assert.equal(await countIn("communityprofiles"), 0);
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/community/reputation");

    assert.equal(response.status, 401);
  });
});
