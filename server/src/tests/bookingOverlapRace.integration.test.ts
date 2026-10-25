// Two people booking overlapping-but-different windows at the same moment must
// not both win.
//
// The slot lock used to be keyed by `date + startTime`, so 10:00-11:00 and
// 10:30-11:30 took different locks, both ran the range-overlap check before
// either had inserted, both saw no conflict, and both committed. Under load
// roughly 4 of 5 overlapping requests succeeded. The lock is now per resource
// per day, so every booking on a venue or coach for a day serializes.
//
// Runs on a replica set, like production, because the lock only works inside a
// transaction.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
if (!process.env.VAPID_PUBLIC_KEY) {
  const keys = require("web-push").generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_EMAIL = "mailto:test@example.invalid";
}

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const { initiateBooking } = require("../client/services/BookingService");
const { Booking } = require("../client/models/Booking");
const { BookingSlotLock } = require("../client/models/BookingSlotLock");
const { Coach } = require("../client/models/Coach");
const { Venue } = require("../client/models/Venue");

let replSet: { getUri(): string; stop(): Promise<void> };

const ACTIVE = [
  "AWAITING_PAYMENT",
  "AWAITING_PROVIDER",
  "PENDING_INVITES",
  "CONFIRMED",
  "IN_PROGRESS",
];

const futureDay = (daysAhead: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysAhead));
};

let userSeq = 0;
const makeUsers = async (count: number): Promise<string[]> => {
  const docs = Array.from({ length: count }, () => {
    const i = userSeq++;
    return {
      _id: new mongoose.Types.ObjectId(),
      name: `Racer ${i}`,
      email: `racer${i}@overlap.test`,
      phone: `98${String(10000000 + i)}`,
      role: "Player",
      googleId: `overlap-${i}`,
    };
  });
  await mongoose.connection.collection("users").insertMany(docs);
  return docs.map((d) => String(d._id));
};

const overlaps = (
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
) => a.startTime < b.endTime && b.startTime < a.endTime;

const anyOverlap = (rows: { startTime: string; endTime: string }[]) =>
  rows.some((a, i) => rows.some((b, j) => i < j && overlaps(a, b)));

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Transactions need the collections to exist first.
  await Booking.createCollection().catch(() => undefined);
  await BookingSlotLock.createCollection().catch(() => undefined);
  await BookingSlotLock.init();
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe("overlapping windows on one resource and day", () => {
  it("never double-books a venue", async () => {
    const users = await makeUsers(40);
    const venue = await Venue.create({
      ownerName: "Owner",
      ownerEmail: "owner@overlap.test",
      ownerPhone: "9800000001",
      name: "Overlap Arena",
      location: { type: "Point", coordinates: [77.1, 28.5] },
      sports: ["Tennis"],
      pricePerHour: 500,
      approvalStatus: "APPROVED",
    });

    // All five overlap each other except 09:30-10:30 / 10:30-11:30, which only touch.
    const windows = [
      ["10:00", "11:00"],
      ["10:30", "11:30"],
      ["10:15", "10:45"],
      ["10:00", "12:00"],
      ["09:30", "10:30"],
    ];

    for (let round = 0; round < 6; round += 1) {
      const date = futureDay(3 + round);
      await Promise.allSettled(
        users.map((userId, i) => {
          const w = windows[i % windows.length]!;
          return initiateBooking({
            userId,
            venueId: String(venue._id),
            sport: "Tennis",
            date,
            startTime: w[0],
            endTime: w[1],
          });
        })
      );

      const rows = await Booking.find({ venueId: venue._id, status: { $in: ACTIVE } })
        .where("date")
        .gte(date)
        .lt(new Date(date.getTime() + 24 * 3600 * 1000))
        .select("startTime endTime")
        .lean();

      assert.ok(rows.length >= 1, `round ${round}: someone must win`);
      assert.equal(
        anyOverlap(rows),
        false,
        `round ${round}: overlapping bookings both succeeded: ${rows
          .map((r: { startTime: string; endTime: string }) => `${r.startTime}-${r.endTime}`)
          .join(" | ")}`
      );
    }
  });

  it("never double-books a coach", async () => {
    const users = await makeUsers(30);
    const coachUser = new mongoose.Types.ObjectId();
    await mongoose.connection.collection("users").insertOne({
      _id: coachUser,
      name: "Coach",
      email: "coach@overlap.test",
      phone: "9800000002",
      role: "Coach",
      googleId: "overlap-coach",
    });
    const coach = await Coach.create({
      userId: coachUser,
      sports: ["Tennis"],
      hourlyRate: 600,
      serviceMode: "FREELANCE",
      serviceRadiusKm: 15,
      baseLocation: { type: "Point", coordinates: [77.2, 28.6] },
      availability: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        startTime: "06:00",
        endTime: "22:00",
      })),
      isVerified: true,
      verificationStatus: "VERIFIED",
    });

    const windows = [
      ["10:00", "11:00"],
      ["10:30", "11:30"],
      ["10:15", "10:45"],
    ];

    for (let round = 0; round < 6; round += 1) {
      const date = futureDay(3 + round);
      await Promise.allSettled(
        users.map((userId, i) => {
          const w = windows[i % windows.length]!;
          return initiateBooking({
            userId,
            coachId: String(coach._id),
            playerLocation: { type: "Point", coordinates: [77.2, 28.6] },
            sport: "Tennis",
            date,
            startTime: w[0],
            endTime: w[1],
          });
        })
      );

      const rows = await Booking.find({ coachId: coach._id, status: { $in: ACTIVE } })
        .where("date")
        .gte(date)
        .lt(new Date(date.getTime() + 24 * 3600 * 1000))
        .select("startTime endTime")
        .lean();

      assert.equal(rows.length, 1, `round ${round}: exactly one overlapping window may win`);
    }
  });
});
