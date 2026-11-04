/* eslint-disable @typescript-eslint/no-var-requires */
// Money-path fixes from the security audit, against an in-memory MongoDB:
//   - a promo code's usage limits are enforced atomically (no double spend)
//   - a booking that carries a PAID share is never deleted without a refund
//
// Run via the build:
//   npm run build && node --test --test-force-exit dist/tests/shopBooking.integration.test.js
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { applyPromoCode, releasePromoUsage } = require("../client/services/PromoCodeService");
const { cleanupExpiredBookings } = require("../client/services/bookingService/maintenance");
const { updatePaymentStatus } = require("../client/services/bookingService/lifecycle");
const { Booking } = require("../client/models/Booking");
const { PromoCode } = require("../shared/models/PromoCode");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
let mongod: any;

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
  await Promise.all([Booking, PromoCode].map((model: any) => model.collection.deleteMany({})));
});

const seedPromo = (extra: Record<string, unknown>) =>
  PromoCode.collection.insertOne({
    code: "SAVE10",
    isActive: true,
    currentUsageCount: 0,
    usedBy: [],
    ...extra,
  });

describe("promo usage limits are enforced atomically", () => {
  it("lets a code limited to one use be spent exactly once, even concurrently", async () => {
    await seedPromo({ maxUsageTotal: 1 });
    const results = await Promise.all(
      [oid(), oid(), oid(), oid(), oid()].map((userId) =>
        applyPromoCode("save10", userId.toString(), null, oid().toString(), 100)
      )
    );
    assert.equal(results.filter(Boolean).length, 1);
    const stored = await PromoCode.collection.findOne({ code: "SAVE10" });
    assert.equal(stored.currentUsageCount, 1);
    assert.equal(stored.usedBy.length, 1);
  });

  it("enforces the per-user limit but lets other users in", async () => {
    await seedPromo({ maxUsagePerUser: 1 });
    const user = oid().toString();
    assert.equal(await applyPromoCode("SAVE10", user, null, oid().toString(), 50), true);
    assert.equal(await applyPromoCode("SAVE10", user, null, oid().toString(), 50), false);
    assert.equal(
      await applyPromoCode("SAVE10", oid().toString(), null, oid().toString(), 50),
      true
    );
  });

  it("treats a missing or zero limit as unlimited", async () => {
    await seedPromo({ maxUsageTotal: 0 });
    for (let i = 0; i < 3; i++) {
      assert.equal(
        await applyPromoCode("SAVE10", oid().toString(), null, oid().toString(), 10),
        true
      );
    }
  });

  it("gives usage back for the order that consumed it, once", async () => {
    await seedPromo({ maxUsageTotal: 1 });
    const orderId = oid().toString();
    assert.equal(await applyPromoCode("SAVE10", oid().toString(), null, orderId, 100), true);
    await releasePromoUsage("SAVE10", orderId);
    await releasePromoUsage("SAVE10", orderId);
    const stored = await PromoCode.collection.findOne({ code: "SAVE10" });
    assert.equal(stored.currentUsageCount, 0);
    assert.equal(stored.usedBy.length, 0);
    assert.equal(
      await applyPromoCode("SAVE10", oid().toString(), null, oid().toString(), 100),
      true
    );
  });
});

describe("a booking with a PAID share is never destroyed", () => {
  const splitBooking = (paid: boolean, extra: Record<string, unknown> = {}) => {
    const organizer = oid();
    const friend = oid();
    return {
      _id: oid(),
      organizerId: organizer,
      userId: organizer,
      venueId: oid(),
      status: "AWAITING_PAYMENT",
      paymentType: "SPLIT",
      participantName: "Test Player",
      participantId: organizer,
      sport: "tennis",
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 1000,
      expiresAt: new Date(Date.now() - 60_000),
      payments: [
        { userId: organizer, userType: "Player", amount: 500, status: paid ? "PAID" : "PENDING" },
        { userId: friend, userType: "Player", amount: 500, status: "PENDING" },
      ],
      ...extra,
    };
  };

  it("expiry cleanup deletes an unpaid booking but keeps a partly paid one", async () => {
    const unpaid = splitBooking(false);
    const partlyPaid = splitBooking(true);
    await Booking.collection.insertMany([unpaid, partlyPaid]);

    const deleted = await cleanupExpiredBookings();

    assert.equal(deleted, 1);
    assert.equal(await Booking.collection.countDocuments({ _id: unpaid._id }), 0);
    assert.equal(await Booking.collection.countDocuments({ _id: partlyPaid._id }), 1);
  });

  it("one payer's failed payment deletes an unpaid booking but not one others have paid", async () => {
    const paidByOrganizer = splitBooking(true, { expiresAt: new Date(Date.now() + 600_000) });
    const friendId = paidByOrganizer.payments[1]!.userId.toString();
    await Booking.collection.insertOne(paidByOrganizer);

    await updatePaymentStatus(paidByOrganizer._id.toString(), friendId, "FAILED");
    assert.equal(
      await Booking.collection.countDocuments({ _id: paidByOrganizer._id }),
      1,
      "a booking another payer has paid for must survive"
    );
    const kept = await Booking.collection.findOne({ _id: paidByOrganizer._id });
    assert.equal(kept.payments[0].status, "PAID");
    assert.equal(kept.payments[1].status, "FAILED");

    const unpaid = splitBooking(false, { expiresAt: new Date(Date.now() + 600_000) });
    await Booking.collection.insertOne(unpaid);
    await updatePaymentStatus(
      unpaid._id.toString(),
      unpaid.payments[1]!.userId.toString(),
      "FAILED"
    );
    assert.equal(await Booking.collection.countDocuments({ _id: unpaid._id }), 0);
  });
});
