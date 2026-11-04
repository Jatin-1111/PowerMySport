/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for migration 21 (backfill CREATED events).
//
// These run against an in-memory MongoDB. That is not a nicety here: the real
// database is shared between dev and prod, and BookingEvent blocks deletes, so
// a trial run against it would leave permanent, unremovable rows. This is the
// only safe place to exercise the migration before applying it for real.
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
const { BookingEvent } = require("../client/models/BookingEvent");
const { up } = require("../migrations/21_backfill_booking_created_events");
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
  // Insert straight through the driver so schema defaults/validation don't
  // reshape the legacy-looking fixtures. BookingEvent has no deleteMany (it is
  // blocked), so drop the collection instead to reset between tests.
  await Booking.collection.deleteMany({});
  await ExpertSession.collection.deleteMany({});
  await BookingEvent.collection.deleteMany({});
});

const seedBooking = async (overrides: Record<string, unknown> = {}) => {
  const _id = oid();
  await Booking.collection.insertOne({
    _id,
    userId: oid(),
    organizerId: oid(),
    venueId: oid(),
    sport: "Tennis",
    date: new Date("2026-05-01T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "10:00",
    totalAmount: 750.5,
    status: "CANCELLED",
    bookingType: "INDIVIDUAL",
    createdAt: new Date("2026-04-01T10:30:00.000Z"),
    updatedAt: new Date("2026-04-02T10:30:00.000Z"),
    ...overrides,
  });
  return _id;
};

const seedSession = async (overrides: Record<string, unknown> = {}) => {
  const _id = oid();
  await ExpertSession.collection.insertOne({
    _id,
    expertId: oid(),
    userId: oid(),
    amount: 1200,
    status: "COMPLETED",
    paymentStatus: "COMPLETED",
    merchantOrderId: `EXP_${Math.random().toString(16).slice(2)}`,
    mode: "ONLINE",
    createdAt: new Date("2026-03-15T08:00:00.000Z"),
    updatedAt: new Date("2026-03-16T08:00:00.000Z"),
    ...overrides,
  });
  return _id;
};

describe("migration 21 — dry run", () => {
  it("writes nothing by default", async () => {
    await seedBooking();
    await seedSession();

    const result = await up();

    assert.equal(result.planned.length, 2);
    assert.equal(result.inserted, 0);
    assert.equal(await BookingEvent.countDocuments({}), 0);
  });
});

describe("migration 21 — apply", () => {
  it("creates exactly one CREATED event per booking and session", async () => {
    await seedBooking();
    await seedBooking();
    await seedSession();

    const result = await up({ apply: true });

    assert.equal(result.inserted, 3);
    assert.equal(await BookingEvent.countDocuments({ type: "CREATED" }), 3);
    assert.equal(await BookingEvent.countDocuments({ subjectType: "BOOKING" }), 2);
    assert.equal(await BookingEvent.countDocuments({ subjectType: "EXPERT_SESSION" }), 1);
  });

  it("dates the event from createdAt, not from now", async () => {
    const bookingId = await seedBooking({
      createdAt: new Date("2025-11-20T06:15:00.000Z"),
    });

    await up({ apply: true });

    const event = await BookingEvent.findOne({ subjectId: bookingId });
    assert.equal(new Date(event.occurredAt).toISOString(), "2025-11-20T06:15:00.000Z");
  });

  it("marks the event as BACKFILL and never invents a creation status", async () => {
    const bookingId = await seedBooking({ status: "CANCELLED" });

    await up({ apply: true });

    const event = await BookingEvent.findOne({ subjectId: bookingId });
    assert.equal(event.channel, "BACKFILL");
    assert.equal(event.actorType, "USER");
    // The booking is CANCELLED *now*; it certainly wasn't when it was created.
    // Writing that into toStatus would be a fabrication.
    assert.equal(event.toStatus, undefined);
    assert.equal(event.fromStatus, undefined);
    assert.equal(event.metadata.backfilled, true);
    assert.equal(event.metadata.statusAtBackfill, "CANCELLED");
  });

  it("converts rupee amounts to paise", async () => {
    const bookingId = await seedBooking({ totalAmount: 750.5 });
    const sessionId = await seedSession({ amount: 1200 });

    await up({ apply: true });

    const bookingEvent = await BookingEvent.findOne({ subjectId: bookingId });
    assert.equal(bookingEvent.amountPaise, 75050);

    const sessionEvent = await BookingEvent.findOne({ subjectId: sessionId });
    assert.equal(sessionEvent.amountPaise, 120000);
  });

  it("attributes the actor to organizerId, falling back to userId", async () => {
    const organizerId = oid();
    const withOrganizer = await seedBooking({ organizerId });
    const userId = oid();
    const withoutOrganizer = await seedBooking({ userId, organizerId: null });

    await up({ apply: true });

    const a = await BookingEvent.findOne({ subjectId: withOrganizer });
    assert.equal(a.actorUserId.toString(), organizerId.toString());

    const b = await BookingEvent.findOne({ subjectId: withoutOrganizer });
    assert.equal(b.actorUserId.toString(), userId.toString());
  });

  it("derives providerType from the booking's provider", async () => {
    const academyBooking = await seedBooking({ academyId: oid() });
    const coachBooking = await seedBooking({ coachId: oid(), academyId: null });

    await up({ apply: true });

    assert.equal(
      (await BookingEvent.findOne({ subjectId: academyBooking })).providerType,
      "ACADEMY"
    );
    assert.equal((await BookingEvent.findOne({ subjectId: coachBooking })).providerType, "COACH");
  });
});

describe("migration 21 — idempotency", () => {
  it("adds nothing on a second apply", async () => {
    await seedBooking();
    await seedSession();

    const first = await up({ apply: true });
    assert.equal(first.inserted, 2);

    const second = await up({ apply: true });
    assert.equal(second.inserted, 0);
    assert.equal(second.planned.length, 0);
    assert.equal(second.skipped.length, 2);
    assert.match(second.skipped[0].reason, /already has a CREATED event/);

    // The critical invariant: still exactly two events, not four. These cannot
    // be deleted, so a duplicate here would be permanent.
    assert.equal(await BookingEvent.countDocuments({}), 2);
  });

  it("backfills only the new subject when run after new bookings appear", async () => {
    await seedBooking();
    await up({ apply: true });

    await seedBooking();
    const second = await up({ apply: true });

    assert.equal(second.inserted, 1);
    assert.equal(await BookingEvent.countDocuments({}), 2);
  });

  it("does not treat a non-CREATED event as already backfilled", async () => {
    const bookingId = await seedBooking();
    // A booking that only ever recorded a cancellation still needs its genesis
    // event — the dedupe key is (subject, CREATED), not just subject.
    await BookingEvent.create({
      subjectType: "BOOKING",
      subjectId: bookingId,
      providerType: "VENUE",
      type: "CANCELLED",
      actorType: "USER",
      channel: "CLIENT_WEB",
      occurredAt: new Date(),
    });

    const result = await up({ apply: true });

    assert.equal(result.inserted, 1);
    assert.equal(await BookingEvent.countDocuments({ subjectId: bookingId, type: "CREATED" }), 1);
  });
});

describe("migration 21 — refuses to guess", () => {
  it("skips a booking with no createdAt rather than dating it now", async () => {
    const bookingId = await seedBooking({ createdAt: null });

    const result = await up({ apply: true });

    assert.equal(result.inserted, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /no createdAt/);
    assert.equal(await BookingEvent.countDocuments({ subjectId: bookingId }), 0);
  });

  it("skips a booking with no attributable actor", async () => {
    await seedBooking({ userId: null, organizerId: null });

    const result = await up({ apply: true });

    assert.equal(result.inserted, 0);
    assert.match(result.skipped[0].reason, /no userId\/organizerId/);
  });

  it("skips an expert session with no userId", async () => {
    await seedSession({ userId: null });

    const result = await up({ apply: true });

    assert.equal(result.inserted, 0);
    assert.match(result.skipped[0].reason, /no userId/);
  });

  it("still records an event when the amount is missing or zero", async () => {
    // A missing amount is not a reason to lose the whole creation record.
    const bookingId = await seedBooking({ totalAmount: 0 });

    const result = await up({ apply: true });

    assert.equal(result.inserted, 1);
    const event = await BookingEvent.findOne({ subjectId: bookingId });
    assert.equal(event.amountPaise, undefined);
  });
});
