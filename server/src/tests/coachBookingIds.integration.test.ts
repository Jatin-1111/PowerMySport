// The coach bookings and calendar queries are lean, which skips the `id`
// virtual. The client reads `booking.id`, so without it the coach bookings page
// crashed and Confirm / Reject sent `undefined`. Both endpoints must return it.
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
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };
let token: string;
let bookingIds: string[];

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
  for (const name of ["users", "coaches", "bookings"]) await col(name).deleteMany({});

  const coachUserId = oid();
  const playerId = oid();
  const coachId = oid();
  await col("users").insertMany([
    {
      _id: coachUserId,
      name: "Test Coach",
      email: "coach@example.test",
      phone: "9100000050",
      role: "Coach",
      isActive: true,
    },
    {
      _id: playerId,
      name: "Test Player",
      email: "player@example.test",
      phone: "9100000051",
      role: "Parent",
      isActive: true,
    },
  ]);
  await col("coaches").insertOne({
    _id: coachId,
    userId: coachUserId,
    bio: "Tennis coach",
    sports: ["Tennis"],
    hourlyRate: 1000,
    isVerified: true,
    verificationStatus: "VERIFIED",
    availability: [],
  });

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const bookings = [
    { _id: oid(), status: "AWAITING_PROVIDER" },
    { _id: oid(), status: "CONFIRMED" },
  ].map((b) => ({
    ...b,
    coachId,
    userId: playerId,
    sport: "tennis",
    date: day,
    startTime: "07:00",
    endTime: "08:00",
    totalAmount: 1000,
  }));
  await col("bookings").insertMany(bookings);
  bookingIds = bookings.map((b) => b._id.toString());

  token = generateToken({ id: coachUserId.toString(), email: "coach@example.test", role: "Coach" });
});

const bearer = () => ({ Authorization: `Bearer ${token}` });

describe("coach booking ids", () => {
  it("GET /api/bookings/my-bookings gives every booking an id equal to its _id", async () => {
    const res = await request(app).get("/api/bookings/my-bookings").set(bearer());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    for (const booking of res.body.data) {
      assert.equal(typeof booking.id, "string");
      assert.equal(booking.id, booking._id);
    }
    assert.deepEqual(res.body.data.map((b: { id: string }) => b.id).sort(), [...bookingIds].sort());
  });

  it("GET /api/coaches/my-profile/calendar gives every booking an id too", async () => {
    const start = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/coaches/my-profile/calendar?startDate=${start}&endDate=${end}`)
      .set(bearer());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.bookings.length, 2);
    for (const booking of res.body.data.bookings) {
      assert.equal(booking.id, booking._id);
    }
  });
});
