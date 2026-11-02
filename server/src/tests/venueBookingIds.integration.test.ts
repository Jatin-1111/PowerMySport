// The venue lister's bookings list is a lean query, which skips the `id`
// virtual. The client reads `booking.id` for list keys and for the id it sends
// to confirm or reject a booking, so without it the bookings page crashed and
// Confirm / Reject sent `undefined`.
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
  for (const name of ["users", "venues", "bookings"]) await col(name).deleteMany({});

  const ownerId = oid();
  const playerId = oid();
  const venueId = oid();
  await col("users").insertMany([
    {
      _id: ownerId,
      name: "Test Venue Owner",
      email: "venue@example.test",
      phone: "9100000060",
      role: "VenueLister",
      isActive: true,
    },
    {
      _id: playerId,
      name: "Test Player",
      email: "player2@example.test",
      phone: "9100000061",
      role: "Parent",
      isActive: true,
    },
  ]);
  await col("venues").insertOne({
    _id: venueId,
    name: "Test Arena",
    ownerId,
    ownerName: "Test Venue Owner",
    approvalStatus: "APPROVED",
    sports: ["Tennis"],
    pricePerHour: 800,
  });

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const bookings = [
    { _id: oid(), status: "AWAITING_PROVIDER" },
    { _id: oid(), status: "CONFIRMED" },
  ].map((b) => ({
    ...b,
    venueId,
    userId: playerId,
    sport: "tennis",
    date: day,
    startTime: "07:00",
    endTime: "08:00",
    totalAmount: 800,
  }));
  await col("bookings").insertMany(bookings);
  bookingIds = bookings.map((b) => b._id.toString());

  token = generateToken({
    id: ownerId.toString(),
    email: "venue@example.test",
    role: "VenueLister",
  });
});

describe("venue booking ids", () => {
  it("GET /api/bookings/my-bookings gives every booking an id equal to its _id", async () => {
    const res = await request(app)
      .get("/api/bookings/my-bookings")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    for (const booking of res.body.data) {
      assert.equal(typeof booking.id, "string");
      assert.equal(booking.id, booking._id);
    }
    assert.deepEqual(res.body.data.map((b: { id: string }) => b.id).sort(), [...bookingIds].sort());
  });
});
