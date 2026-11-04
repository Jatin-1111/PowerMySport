/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the booking audit log. Uses an in-memory MongoDB, so
// nothing external — and in particular nothing in the shared dev/prod
// database — is touched. That matters more than usual here: BookingEvent is
// append-only by design, so a stray test row written to the real database
// could never be deleted.
//
// Env must be set BEFORE the app modules are required (several read env at
// load time), so we use require() in source order rather than hoisted imports.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { BookingEvent } = require("../client/models/BookingEvent");
const {
  BookingEventService,
  providerDimensionsForBooking,
} = require("../client/services/BookingEventService");
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

const seedEvent = async (overrides: Record<string, unknown> = {}) =>
  BookingEvent.create({
    subjectType: "BOOKING",
    subjectId: oid(),
    providerType: "VENUE",
    type: "CREATED",
    actorType: "USER",
    channel: "CLIENT_WEB",
    occurredAt: new Date(),
    ...overrides,
  });

// ───────────────── append-only enforcement ─────────────────
describe("BookingEvent is append-only", () => {
  it("allows the initial insert", async () => {
    const event = await seedEvent();
    assert.ok(event._id);
    assert.equal(event.type, "CREATED");
  });

  it("rejects re-saving an existing event", async () => {
    const event = await seedEvent();
    event.summary = "tampered";
    await assert.rejects(() => event.save(), /append-only/);
  });

  it("rejects updateOne", async () => {
    const event = await seedEvent();
    await assert.rejects(
      () => BookingEvent.updateOne({ _id: event._id }, { $set: { type: "CANCELLED" } }),
      /append-only/
    );
  });

  it("rejects updateMany", async () => {
    await seedEvent();
    await assert.rejects(
      () => BookingEvent.updateMany({}, { $set: { summary: "x" } }),
      /append-only/
    );
  });

  it("rejects findOneAndUpdate", async () => {
    const event = await seedEvent();
    await assert.rejects(
      () => BookingEvent.findOneAndUpdate({ _id: event._id }, { $set: { summary: "x" } }),
      /append-only/
    );
  });

  it("rejects replaceOne", async () => {
    const event = await seedEvent();
    await assert.rejects(
      () => BookingEvent.replaceOne({ _id: event._id }, { summary: "x" }),
      /append-only/
    );
  });

  it("rejects deleteOne and deleteMany", async () => {
    const event = await seedEvent();
    await assert.rejects(() => BookingEvent.deleteOne({ _id: event._id }), /append-only/);
    await assert.rejects(() => BookingEvent.deleteMany({}), /append-only/);
  });

  it("rejects findOneAndDelete", async () => {
    const event = await seedEvent();
    await assert.rejects(() => BookingEvent.findOneAndDelete({ _id: event._id }), /append-only/);
  });

  it("rejects document-level deleteOne()", async () => {
    const event = await seedEvent();
    await assert.rejects(() => event.deleteOne(), /append-only/);
  });

  it("leaves the record intact after every rejected mutation", async () => {
    const event = await seedEvent({ summary: "original" });
    await BookingEvent.updateOne({ _id: event._id }, { $set: { summary: "x" } }).catch(() => {});
    await BookingEvent.deleteOne({ _id: event._id }).catch(() => {});

    const found = await BookingEvent.findById(event._id);
    assert.ok(found, "event should still exist");
    assert.equal(found.summary, "original");
  });
});

// ───────────────── record() must never break its caller ─────────────────
describe("BookingEventService.record never throws into the caller", () => {
  it("returns null instead of throwing on an invalid subjectId", async () => {
    const result = await BookingEventService.record({
      subjectType: "BOOKING",
      subjectId: "not-an-object-id",
      providerType: "VENUE",
      type: "CREATED",
      actorType: "USER",
      channel: "CLIENT_WEB",
    });
    assert.equal(result, null);
  });

  it("returns null instead of throwing on a schema violation", async () => {
    // BOOKING_EVENT_TYPES has no such member — the enum validator rejects it,
    // and the service is expected to absorb that.
    const result = await BookingEventService.record({
      subjectType: "BOOKING",
      subjectId: oid(),
      providerType: "VENUE",
      type: "NOT_A_REAL_EVENT_TYPE",
      actorType: "USER",
      channel: "CLIENT_WEB",
    });
    assert.equal(result, null);
  });

  it("drops an invalid actorUserId rather than failing the write", async () => {
    const result = await BookingEventService.record({
      subjectType: "BOOKING",
      subjectId: oid(),
      providerType: "VENUE",
      type: "CREATED",
      actorType: "SYSTEM",
      actorUserId: "garbage",
      channel: "CRON",
    });
    assert.ok(result, "event should still be recorded");
    assert.equal(result.actorUserId, undefined);
  });

  it("rounds amountPaise and rejects negatives", async () => {
    const rounded = await BookingEventService.record({
      subjectType: "BOOKING",
      subjectId: oid(),
      providerType: "VENUE",
      type: "PAYMENT_CONFIRMED",
      actorType: "GATEWAY",
      channel: "WEBHOOK",
      amountPaise: 12345.6,
    });
    assert.equal(rounded.amountPaise, 12346);

    const negative = await BookingEventService.record({
      subjectType: "BOOKING",
      subjectId: oid(),
      providerType: "VENUE",
      type: "PAYMENT_CONFIRMED",
      actorType: "GATEWAY",
      channel: "WEBHOOK",
      amountPaise: -500,
    });
    assert.equal(negative.amountPaise, undefined);
  });
});

// ───────────────── provider dimension derivation ─────────────────
describe("providerDimensionsForBooking", () => {
  it("treats an academy booking as ACADEMY even alongside venue/coach", () => {
    const academyId = oid();
    const result = providerDimensionsForBooking({
      venueId: oid(),
      coachId: oid(),
      academyId,
    });
    assert.equal(result.providerType, "ACADEMY");
    assert.equal(result.providerId.toString(), academyId.toString());
  });

  it("prefers COACH over VENUE for a coached session at a venue", () => {
    // The coach is the party whose acceptance and payout the lifecycle turns
    // on, so the event should be attributed to them.
    const coachId = oid();
    const result = providerDimensionsForBooking({ venueId: oid(), coachId });
    assert.equal(result.providerType, "COACH");
    assert.equal(result.providerId.toString(), coachId.toString());
  });

  it("falls back to VENUE", () => {
    const venueId = oid();
    const result = providerDimensionsForBooking({ venueId });
    assert.equal(result.providerType, "VENUE");
    assert.equal(result.providerId.toString(), venueId.toString());
  });

  it("omits providerId when no provider id is present at all", () => {
    const result = providerDimensionsForBooking({});
    assert.equal(result.providerType, "VENUE");
    assert.equal(result.providerId, undefined);
  });
});

// ───────────────── timeline reads ─────────────────
describe("timeline queries", () => {
  it("returns one subject's events in chronological order", async () => {
    const subjectId = oid();
    const base = Date.now();

    // Inserted out of order on purpose.
    await seedEvent({
      subjectId,
      type: "PAYMENT_CONFIRMED",
      occurredAt: new Date(base + 2000),
    });
    await seedEvent({ subjectId, type: "CREATED", occurredAt: new Date(base) });
    await seedEvent({
      subjectId,
      type: "PROVIDER_CONFIRMED",
      occurredAt: new Date(base + 1000),
    });
    // A different booking's event must not leak in.
    await seedEvent({ subjectId: oid(), type: "CANCELLED" });

    const timeline = await BookingEventService.getTimeline("BOOKING", subjectId.toString());

    assert.deepEqual(
      timeline.map((e: any) => e.type),
      ["CREATED", "PROVIDER_CONFIRMED", "PAYMENT_CONFIRMED"]
    );
  });

  it("does not mix BOOKING and EXPERT_SESSION events sharing an id", async () => {
    const sharedId = oid();
    await seedEvent({ subjectId: sharedId, type: "CREATED" });
    await seedEvent({
      subjectId: sharedId,
      subjectType: "EXPERT_SESSION",
      providerType: "EXPERT",
      type: "CANCELLED",
    });

    const bookingTimeline = await BookingEventService.getTimeline("BOOKING", sharedId.toString());
    assert.deepEqual(
      bookingTimeline.map((e: any) => e.type),
      ["CREATED"]
    );

    // The support-tooling lookup deliberately spans both.
    const both = await BookingEventService.getTimelineByIdAcrossSubjects(sharedId.toString());
    assert.equal(both.length, 2);
  });

  it("returns empty for a malformed id instead of throwing", async () => {
    assert.deepEqual(await BookingEventService.getTimeline("BOOKING", "nope"), []);
    assert.deepEqual(await BookingEventService.getTimelineByIdAcrossSubjects("nope"), []);
  });
});
