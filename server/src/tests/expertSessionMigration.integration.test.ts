/* eslint-disable @typescript-eslint/no-var-requires */
// Tests for migration 25 (ExpertSession -> Booking).
//
// In-memory MongoDB only. This migration writes to the bookings collection in a
// database that is also production, so every branch is exercised here first.
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
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Review } = require("../client/models/Review");
const { Expert } = require("../client/models/ExpertProfile");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const migration25 = require("../migrations/25_migrate_expert_sessions_to_bookings");
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
  await ExpertSession.collection.deleteMany({});
  await Review.collection.deleteMany({});
  await Expert.collection.deleteMany({});
  await User.collection.deleteMany({});
  await Player.collection.deleteMany({});
});

const seedExpertWithUser = async () => {
  const expertUserId = oid();
  await User.collection.insertOne({
    _id: expertUserId,
    name: "Expert Person",
    email: `e-${expertUserId}@t.com`,
    phone: "1",
    role: "EXPERT",
    password: "x",
  });
  const expertId = oid();
  await Expert.collection.insertOne({
    _id: expertId,
    userId: expertUserId,
    sessionFee: 1000,
    sessionMode: "ONLINE",
  });
  return { expertId, expertUserId };
};

const seedSession = async (overrides: Record<string, unknown> = {}) => {
  const { expertId, expertUserId } = await seedExpertWithUser();
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `p-${userId}@t.com`,
    phone: "2",
    role: "Parent",
    password: "x",
  });

  const _id = oid();
  await ExpertSession.collection.insertOne({
    _id,
    expertId,
    userId,
    amount: 1000,
    status: "SCHEDULED",
    paymentStatus: "COMPLETED",
    merchantOrderId: `EXP_${_id}`,
    scheduledAt: new Date("2026-05-01T04:30:00.000Z"), // 10:00 IST
    durationMinutes: 60,
    mode: "ONLINE",
    expertAcceptance: "ACCEPTED",
    refundStatus: "NONE",
    payoutStatus: "PENDING",
    reviewed: false,
    paidAt: new Date("2026-04-20T10:00:00.000Z"),
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    ...overrides,
  });
  return { sessionId: _id, expertId, expertUserId, userId };
};

const bookingFor = async (sessionId: any) =>
  Booking.collection.findOne({ "expert.legacySessionId": sessionId.toString() });

describe("migration 25 — dry run", () => {
  it("writes nothing", async () => {
    await seedSession();
    const result = await migration25.up();

    assert.equal(result.migrated.length, 1);
    assert.equal(await Booking.collection.countDocuments({}), 0);
  });
});

describe("migration 25 — core field mapping", () => {
  it("creates an EXPERT booking with the instant authoritative and the slot derived", async () => {
    const { sessionId, expertId } = await seedSession();
    await migration25.up({ apply: true });

    const booking = await bookingFor(sessionId);
    assert.ok(booking);
    assert.equal(booking.providerType, "EXPERT");
    assert.equal(booking.expertId.toString(), expertId.toString());
    assert.equal(booking.status, "CONFIRMED", "SCHEDULED + ACCEPTED");
    assert.equal(booking.totalAmount, 1000, "Booking stays rupee-denominated");
    assert.equal(new Date(booking.scheduledAt).toISOString(), "2026-05-01T04:30:00.000Z");
    assert.equal(booking.durationMinutes, 60);
    // Derived so the existing slot/listing queries can see expert bookings.
    assert.equal(new Date(booking.date).toISOString(), "2026-05-01T00:00:00.000Z");
    assert.equal(booking.startTime, "10:00");
    assert.equal(booking.endTime, "11:00");
  });

  it("maps acceptance, timestamps and cancellation vocabulary", async () => {
    const { sessionId } = await seedSession({
      status: "CANCELLED",
      expertAcceptance: "DECLINED",
      cancelledBy: "EXPERT",
      cancelReason: "unavailable",
      cancelledAt: new Date("2026-04-25T00:00:00.000Z"),
      cancellationNoticeHours: 120,
      refundStatus: "REQUIRED",
    });
    await migration25.up({ apply: true });

    const booking = await bookingFor(sessionId);
    assert.equal(booking.status, "CANCELLED");
    assert.equal(booking.providerAcceptance, "DECLINED");
    assert.equal(booking.cancelledBy, "PROVIDER", "EXPERT is renamed PROVIDER");
    assert.equal(booking.cancellationReason, "unavailable");
    assert.equal(booking.cancellationNoticeHours, 120);
    assert.equal(booking.expert.manualRefundStatus, "REQUIRED");
  });

  it("maps a lapsed unpaid hold to EXPIRED", async () => {
    const { sessionId } = await seedSession({
      status: "CANCELLED",
      paymentStatus: "PENDING",
      cancelledBy: "SYSTEM",
      cancelReason: "Payment not completed in time",
      paidAt: null,
    });
    await migration25.up({ apply: true });

    assert.equal((await bookingFor(sessionId)).status, "EXPIRED");
  });

  it("moves expert-only state into the expert subdocument", async () => {
    const { sessionId } = await seedSession({
      meetingLink: "https://meet.test/x",
      clientNote: "please focus on serve technique",
      momNotes: "Covered serve mechanics and follow-through.",
      momAddedAt: new Date("2026-05-01T06:00:00.000Z"),
    });
    await migration25.up({ apply: true });

    const { expert } = await bookingFor(sessionId);
    assert.equal(expert.mode, "ONLINE");
    assert.equal(expert.meetingLink, "https://meet.test/x");
    assert.equal(expert.clientNote, "please focus on serve technique");
    assert.match(expert.momNotes, /serve mechanics/);
    assert.ok(expert.momAddedAt);
    assert.equal(expert.legacySessionId, sessionId.toString());
  });

  it("records a payee entry so the shared payout job can see expert bookings", async () => {
    const { sessionId, expertUserId, userId } = await seedSession({
      payoutStatus: "PAID",
      payoutPaidAt: new Date("2026-05-02T00:00:00.000Z"),
    });
    await migration25.up({ apply: true });

    const { payments } = await bookingFor(sessionId);
    const payee = payments.find((p: any) => p.userType === "Expert");
    const payer = payments.find((p: any) => p.userType === "Player");

    assert.ok(payee, "an Expert payee entry must exist");
    assert.equal(payee.userId.toString(), expertUserId.toString());
    assert.equal(payee.status, "PAID");
    assert.equal(payer.userId.toString(), userId.toString());
    assert.equal(payer.status, "PAID");
  });

  it("names the participant after the child when one was chosen", async () => {
    const playerId = oid();
    const { sessionId, userId } = await seedSession({ playerId });
    await Player.collection.insertOne({
      _id: playerId,
      userId,
      name: "Young Athlete",
      type: "DEPENDENT",
    });

    await migration25.up({ apply: true });

    const booking = await bookingFor(sessionId);
    assert.equal(booking.participantName, "Young Athlete");
    assert.equal(booking.participantId.toString(), playerId.toString());
  });

  it("falls back to the booking user's name when there is no child", async () => {
    const { sessionId } = await seedSession();
    await migration25.up({ apply: true });
    assert.equal((await bookingFor(sessionId)).participantName, "Parent Person");
  });

  it("preserves the original timestamps", async () => {
    const { sessionId } = await seedSession();
    await migration25.up({ apply: true });

    const booking = await bookingFor(sessionId);
    assert.equal(new Date(booking.createdAt).toISOString(), "2026-04-20T09:00:00.000Z");
  });
});

describe("migration 25 — reviews", () => {
  it("lifts an inline review onto the shared Review model", async () => {
    const { sessionId, expertId, userId } = await seedSession({
      status: "COMPLETED",
      reviewed: true,
      rating: 5,
      review: "Excellent session",
      reviewAnonymous: true,
      reviewHidden: false,
      reviewedAt: new Date("2026-05-02T00:00:00.000Z"),
    });
    await migration25.up({ apply: true });

    const booking = await bookingFor(sessionId);
    const review = await Review.collection.findOne({ targetType: "EXPERT" });

    assert.ok(review);
    assert.equal(review.targetId.toString(), expertId.toString());
    assert.equal(review.userId.toString(), userId.toString());
    assert.equal(review.bookingId.toString(), booking._id.toString());
    assert.equal(review.rating, 5);
    assert.equal(review.review, "Excellent session");
    assert.equal(
      review.isAnonymous,
      true,
      "anonymity must survive — losing it would expose a reviewer who opted out"
    );
    assert.equal(review.isVerified, true);
  });

  it("creates no review when the session was never reviewed", async () => {
    await seedSession();
    await migration25.up({ apply: true });
    assert.equal(await Review.collection.countDocuments({}), 0);
  });
});

describe("migration 25 — safety", () => {
  it("is idempotent", async () => {
    await seedSession();
    await migration25.up({ apply: true });
    const second = await migration25.up({ apply: true });

    assert.equal(second.migrated.length, 0);
    assert.equal(second.skipped[0].reason, "already migrated");
    assert.equal(await Booking.collection.countDocuments({}), 1);
  });

  it("skips a session with no scheduledAt rather than inventing a slot", async () => {
    await seedSession({ scheduledAt: null });
    const result = await migration25.up({ apply: true });

    assert.equal(result.migrated.length, 0);
    assert.match(result.skipped[0].reason, /no scheduledAt/);
    assert.equal(await Booking.collection.countDocuments({}), 0);
  });

  it("warns rather than failing when the expert has no owning user", async () => {
    const orphanExpertId = oid();
    await Expert.collection.insertOne({
      _id: orphanExpertId,
      sessionFee: 1000,
      sessionMode: "ONLINE",
    });
    const { sessionId } = await seedSession();
    await ExpertSession.collection.updateOne(
      { _id: sessionId },
      { $set: { expertId: orphanExpertId } }
    );

    const result = await migration25.up({ apply: true });

    assert.equal(result.migrated.length, 1);
    assert.ok(result.warnings.some((w: string) => /no owning user/.test(w)));
    const { payments } = await bookingFor(sessionId);
    assert.equal(payments.filter((p: any) => p.userType === "Expert").length, 0);
  });

  it("warns when a session crosses IST midnight", async () => {
    // 23:30 IST + 90m would wrap; deriveSlotFromInstant clamps and this flags it.
    await seedSession({
      scheduledAt: new Date("2026-05-01T18:00:00.000Z"),
      durationMinutes: 90,
    });
    const result = await migration25.up({ apply: true });
    assert.ok(result.warnings.some((w: string) => /crosses IST midnight/.test(w)));
  });

  it("leaves the original ExpertSession documents untouched", async () => {
    const { sessionId } = await seedSession();
    const before = await ExpertSession.collection.findOne({ _id: sessionId });

    await migration25.up({ apply: true });

    const after = await ExpertSession.collection.findOne({ _id: sessionId });
    assert.deepEqual(after, before, "the old collection stays the fallback");
  });

  it("rolls back cleanly, removing only what it created", async () => {
    const { sessionId } = await seedSession({
      status: "COMPLETED",
      reviewed: true,
      rating: 4,
    });
    // A pre-existing non-expert booking must survive the rollback.
    await Booking.collection.insertOne({
      _id: oid(),
      userId: oid(),
      organizerId: oid(),
      venueId: oid(),
      providerType: "VENUE",
      sport: "Tennis",
      date: new Date(),
      startTime: "09:00",
      endTime: "10:00",
      totalAmount: 100,
      status: "CONFIRMED",
      participantName: "X",
      payments: [],
      participants: [],
    });

    await migration25.up({ apply: true });
    assert.equal(await Booking.collection.countDocuments({}), 2);

    await migration25.down({ apply: true });

    assert.equal(await Booking.collection.countDocuments({}), 1);
    assert.equal(await Review.collection.countDocuments({}), 0);
    assert.equal(
      (await Booking.collection.findOne({})).providerType,
      "VENUE",
      "the unrelated booking survives"
    );
    assert.ok(
      await ExpertSession.collection.findOne({ _id: sessionId }),
      "the source session is still intact"
    );
  });
});
