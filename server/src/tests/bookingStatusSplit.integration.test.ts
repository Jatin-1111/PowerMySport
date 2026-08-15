/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the AWAITING_PAYMENT / AWAITING_PROVIDER split.
//
// The point of separating these two states is that they need different
// handling: an unpaid booking is an abandoned checkout that gets cleaned up, a
// paid one owes the customer money if it lapses. These tests pin that
// difference, and in particular the safety property that the cleanup job can
// never delete a booking that was paid for.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Booking } = require("../client/models/Booking");
const { BookingEvent } = require("../client/models/BookingEvent");
const {
  updatePaymentStatus,
  cleanupExpiredBookings,
} = require("../client/services/BookingService");
const migration23 = require("../migrations/23_split_pending_confirmation_status");
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
  await Booking.collection.deleteMany({});
  await BookingEvent.collection.deleteMany({});
});

/** Inserted through the driver so legacy/invalid statuses can be seeded. */
const seedBooking = async (overrides: Record<string, unknown> = {}) => {
  const _id = oid();
  const userId = overrides.userId ?? oid();
  await Booking.collection.insertOne({
    _id,
    userId,
    organizerId: userId,
    venueId: oid(),
    providerType: "VENUE",
    sport: "Tennis",
    date: new Date("2026-09-01T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "10:00",
    totalAmount: 500,
    status: "AWAITING_PAYMENT",
    participantName: "Test Player",
    bookingType: "INDIVIDUAL",
    paymentType: "SINGLE",
    payments: [],
    participants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return { _id, userId };
};

// ───────── the transition the split exists for ─────────
describe("payment moves a booking from AWAITING_PAYMENT to AWAITING_PROVIDER", () => {
  it("transitions once the player's share is fully paid", async () => {
    const payerId = oid();
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      payments: [
        { userId: payerId, userType: "Player", amount: 500, status: "PENDING" },
      ],
    });

    const updated = await updatePaymentStatus(
      _id.toString(),
      payerId.toString(),
      "PAID",
    );

    assert.equal(updated.status, "AWAITING_PROVIDER");
    assert.ok(updated.paymentConfirmedAt, "paymentConfirmedAt should be set");
  });

  it("stays AWAITING_PAYMENT while a split booking is only partly paid", async () => {
    const payerA = oid();
    const payerB = oid();
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      paymentType: "SPLIT",
      payments: [
        { userId: payerA, userType: "Player", amount: 250, status: "PENDING" },
        { userId: payerB, userType: "Player", amount: 250, status: "PENDING" },
      ],
    });

    const afterFirst = await updatePaymentStatus(
      _id.toString(),
      payerA.toString(),
      "PAID",
    );
    assert.equal(afterFirst.status, "AWAITING_PAYMENT");
    assert.equal(afterFirst.paymentConfirmedAt, undefined);

    const afterSecond = await updatePaymentStatus(
      _id.toString(),
      payerB.toString(),
      "PAID",
    );
    assert.equal(afterSecond.status, "AWAITING_PROVIDER");
  });

  it("does not drag a CONFIRMED booking backwards", async () => {
    const payerId = oid();
    const { _id } = await seedBooking({
      status: "CONFIRMED",
      payments: [
        { userId: payerId, userType: "Player", amount: 500, status: "PENDING" },
      ],
    });

    const updated = await updatePaymentStatus(
      _id.toString(),
      payerId.toString(),
      "PAID",
    );

    assert.equal(updated.status, "CONFIRMED");
  });

  it("ignores payee (non-Player) entries when deciding fully-paid", async () => {
    // Venue/coach/academy entries are payouts, released by a separate job —
    // they must not hold the booking in AWAITING_PAYMENT.
    const payerId = oid();
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      payments: [
        { userId: payerId, userType: "Player", amount: 500, status: "PENDING" },
        { userId: oid(), userType: "VenueLister", amount: 400, status: "PENDING" },
      ],
    });

    const updated = await updatePaymentStatus(
      _id.toString(),
      payerId.toString(),
      "PAID",
    );

    assert.equal(updated.status, "AWAITING_PROVIDER");
  });
});

// ───────── the safety property ─────────
describe("expired-booking cleanup never deletes a paid booking", () => {
  const past = new Date(Date.now() - 60 * 60 * 1000);

  it("deletes an expired unpaid hold", async () => {
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      expiresAt: past,
    });

    const deleted = await cleanupExpiredBookings();

    assert.equal(deleted, 1);
    assert.equal(await Booking.countDocuments({ _id }), 0);
  });

  it("leaves an expired PAID booking alone", async () => {
    // This is the case that matters: AWAITING_PROVIDER means money changed
    // hands. Deleting it would destroy the record of a refund we owe.
    const { _id } = await seedBooking({
      status: "AWAITING_PROVIDER",
      expiresAt: past,
      paymentConfirmedAt: new Date(),
    });

    const deleted = await cleanupExpiredBookings();

    assert.equal(deleted, 0);
    assert.equal(await Booking.countDocuments({ _id }), 1);
  });

  it("records an EXPIRED event before deleting, so the booking leaves a trace", async () => {
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      expiresAt: past,
    });

    await cleanupExpiredBookings();

    const events = await BookingEvent.find({ subjectId: _id });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "EXPIRED");
    assert.equal(events[0].fromStatus, "AWAITING_PAYMENT");
    assert.equal(events[0].metadata.bookingDeleted, true);
  });

  it("leaves a hold that has not expired yet", async () => {
    const { _id } = await seedBooking({
      status: "AWAITING_PAYMENT",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    assert.equal(await cleanupExpiredBookings(), 0);
    assert.equal(await Booking.countDocuments({ _id }), 1);
  });
});

// ───────── migration 23 ─────────
describe("migration 23 splits legacy rows by paymentConfirmedAt", () => {
  it("routes paid rows to AWAITING_PROVIDER and unpaid to AWAITING_PAYMENT", async () => {
    const paid = await seedBooking({
      status: "PENDING_CONFIRMATION",
      paymentConfirmedAt: new Date(),
    });
    const unpaid = await seedBooking({ status: "PENDING_CONFIRMATION" });
    const explicitNull = await seedBooking({
      status: "PENDING_CONFIRMATION",
      paymentConfirmedAt: null,
    });

    const result = await migration23.up({ apply: true });

    assert.equal(result.toProvider, 1);
    assert.equal(result.toPayment, 2);
    assert.equal(result.remaining, 0);

    assert.equal(
      (await Booking.collection.findOne({ _id: paid._id })).status,
      "AWAITING_PROVIDER",
    );
    assert.equal(
      (await Booking.collection.findOne({ _id: unpaid._id })).status,
      "AWAITING_PAYMENT",
    );
    assert.equal(
      (await Booking.collection.findOne({ _id: explicitNull._id })).status,
      "AWAITING_PAYMENT",
    );
  });

  it("writes nothing on a dry run", async () => {
    const { _id } = await seedBooking({ status: "PENDING_CONFIRMATION" });

    const result = await migration23.up();

    assert.equal(result.modified, 0);
    assert.equal(
      (await Booking.collection.findOne({ _id })).status,
      "PENDING_CONFIRMATION",
    );
  });

  it("does not touch bookings in other states", async () => {
    const confirmed = await seedBooking({ status: "CONFIRMED" });
    const cancelled = await seedBooking({ status: "CANCELLED" });

    await migration23.up({ apply: true });

    assert.equal(
      (await Booking.collection.findOne({ _id: confirmed._id })).status,
      "CONFIRMED",
    );
    assert.equal(
      (await Booking.collection.findOne({ _id: cancelled._id })).status,
      "CANCELLED",
    );
  });

  it("is idempotent", async () => {
    await seedBooking({ status: "PENDING_CONFIRMATION" });

    await migration23.up({ apply: true });
    const second = await migration23.up({ apply: true });

    assert.equal(second.toProvider, 0);
    assert.equal(second.toPayment, 0);
    assert.equal(second.modified, 0);
  });

  it("folds both states back on rollback", async () => {
    await seedBooking({ status: "AWAITING_PAYMENT" });
    await seedBooking({ status: "AWAITING_PROVIDER" });

    await migration23.down({ apply: true });

    assert.equal(
      await Booking.collection.countDocuments({ status: "PENDING_CONFIRMATION" }),
      2,
    );
  });
});
