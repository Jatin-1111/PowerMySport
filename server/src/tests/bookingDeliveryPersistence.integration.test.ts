/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for persisting Booking.delivery and for migration 29.
// Uses an in-memory MongoDB, so nothing in the shared dev/prod database is
// touched — which matters here because migration 29 issues a bulk write over
// the whole bookings collection.
//
// Env must be set BEFORE the app modules are required (several read env at
// load time), so we use require() in source order rather than hoisted imports.
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
const { up: migration29 } = require("../migrations/29_backfill_booking_delivery");
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
  await mongoose.connection.db.collection("bookings").deleteMany({});
  await mongoose.connection.db.collection("venues").deleteMany({});
  await mongoose.connection.db.collection("coaches").deleteMany({});
  await mongoose.connection.db.collection("academies").deleteMany({});
});

const bookingFields = (overrides: Record<string, unknown> = {}) => {
  const userId = oid();
  return {
    userId,
    organizerId: userId,
    sport: "Chess",
    date: new Date("2026-09-01T00:00:00.000Z"),
    startTime: "18:00",
    endTime: "19:00",
    totalAmount: 500,
    participantName: "Test Player",
    ...overrides,
  };
};

/** Legacy rows are inserted raw — that is exactly what the migration meets. */
const insertLegacyBooking = async (overrides: Record<string, unknown> = {}) => {
  const doc = { ...bookingFields(overrides), providerType: "VENUE" };
  const result = await mongoose.connection.db
    .collection("bookings")
    .insertOne(doc);
  return result.insertedId;
};

// ───────────────── the model persists delivery ─────────────────

describe("Booking.delivery persistence", () => {
  it("round-trips a snapshotted venue delivery", async () => {
    const venueId = oid();
    const booking = await Booking.create(
      bookingFields({
        venueId,
        delivery: {
          kind: "PLATFORM_VENUE",
          venueId,
          nameSnapshot: "Baseline Arena",
          addressSnapshot: "44 MG Road, Bengaluru",
          coordinates: [77.5946, 12.9716],
        },
      }),
    );

    const reloaded = await Booking.findById(booking._id);
    assert.equal(reloaded.delivery.kind, "PLATFORM_VENUE");
    assert.equal(reloaded.delivery.addressSnapshot, "44 MG Road, Bengaluru");
    assert.deepEqual(
      Array.from(reloaded.delivery.coordinates),
      [77.5946, 12.9716],
    );
  });

  it("stores a student-location delivery with no address", async () => {
    const booking = await Booking.create(
      bookingFields({
        coachId: oid(),
        delivery: {
          kind: "STUDENT_LOCATION",
          coordinates: [77.6101, 12.9345],
        },
      }),
    );

    const reloaded = await Booking.findById(booking._id);
    assert.equal(reloaded.delivery.kind, "STUDENT_LOCATION");
    assert.equal(reloaded.delivery.addressSnapshot, undefined);
  });

  it("still accepts a booking with no delivery at all (legacy rows)", async () => {
    const booking = await Booking.create(bookingFields({ venueId: oid() }));
    assert.equal(booking.delivery, undefined);
  });
});

// ───────────────── the per-kind invariants actually fire ─────────────────
// A validator that is never exercised is a validator that does not work.

describe("Booking.delivery invariants", () => {
  it("rejects PLATFORM_VENUE with no venueId", async () => {
    await assert.rejects(
      () =>
        Booking.create(
          bookingFields({
            venueId: oid(),
            delivery: { kind: "PLATFORM_VENUE", addressSnapshot: "somewhere" },
          }),
        ),
      /delivery is missing the fields its kind requires/,
    );
  });

  it("rejects STUDENT_LOCATION with no coordinates", async () => {
    await assert.rejects(
      () =>
        Booking.create(
          bookingFields({
            coachId: oid(),
            delivery: { kind: "STUDENT_LOCATION", addressSnapshot: "31 Koramangala" },
          }),
        ),
      /delivery is missing the fields its kind requires/,
    );
  });

  it("rejects an unknown delivery kind", async () => {
    await assert.rejects(() =>
      Booking.create(
        bookingFields({
          venueId: oid(),
          delivery: { kind: "TELEPORT", venueId: oid() },
        }),
      ),
    );
  });

  it("allows PROVIDER_VENUE with no address — a coach may not have filled it in", async () => {
    const booking = await Booking.create(
      bookingFields({
        coachId: oid(),
        delivery: { kind: "PROVIDER_VENUE" },
      }),
    );
    assert.equal(booking.delivery.kind, "PROVIDER_VENUE");
  });
});

// ───────────────── migration 29 ─────────────────

describe("migration 29 — backfill delivery", () => {
  it("snapshots the venue address onto venue bookings", async () => {
    const venueId = oid();
    await mongoose.connection.db.collection("venues").insertOne({
      _id: venueId,
      name: "Baseline Arena",
      address: "44 MG Road, Bengaluru",
      location: { type: "Point", coordinates: [77.5946, 12.9716] },
    });
    const bookingId = await insertLegacyBooking({ venueId });

    await migration29({ apply: true });

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(row.delivery.kind, "PLATFORM_VENUE");
    assert.equal(row.delivery.addressSnapshot, "44 MG Road, Bengaluru");
  });

  it("refuses to guess: a freelance coach booking is left with no delivery", async () => {
    // The student's address was discarded at booking time and is genuinely
    // gone. Writing the coach's base location here would put a wrong address
    // on a tax invoice, which is worse than leaving the field absent.
    const coachId = oid();
    await mongoose.connection.db.collection("coaches").insertOne({
      _id: coachId,
      serviceMode: "FREELANCE",
      baseLocation: { type: "Point", coordinates: [77.5, 12.9] },
    });
    const bookingId = await insertLegacyBooking({ coachId });

    const result = await migration29({ apply: true });

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(row.delivery, undefined);
    assert.equal(result.unrecoverable, 1);
  });

  it("snapshots an OWN_VENUE coach's own venue", async () => {
    const coachId = oid();
    await mongoose.connection.db.collection("coaches").insertOne({
      _id: coachId,
      serviceMode: "OWN_VENUE",
      ownVenueDetails: {
        name: "Kasparov Chess Room",
        address: "12 Residency Road, Bengaluru",
        location: { type: "Point", coordinates: [77.6033, 12.9698] },
      },
    });
    const bookingId = await insertLegacyBooking({ coachId });

    await migration29({ apply: true });

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(row.delivery.kind, "PROVIDER_VENUE");
    assert.equal(row.delivery.addressSnapshot, "12 Residency Road, Bengaluru");
  });

  it("composes an academy's address fields into one line", async () => {
    const academyId = oid();
    await mongoose.connection.db.collection("academies").insertOne({
      _id: academyId,
      name: "Southside Academy",
      address: "7 Hosur Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560029",
    });
    const bookingId = await insertLegacyBooking({ academyId });

    await migration29({ apply: true });

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(
      row.delivery.addressSnapshot,
      "7 Hosur Road, Bengaluru, Karnataka, 560029",
    );
  });

  it("writes nothing on a dry run", async () => {
    const venueId = oid();
    await mongoose.connection.db
      .collection("venues")
      .insertOne({ _id: venueId, name: "Arena", address: "1 Road" });
    const bookingId = await insertLegacyBooking({ venueId });

    const result = await migration29();

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(row.delivery, undefined);
    assert.equal(result.planned, 1);
    assert.equal(result.modified, 0);
  });

  it("is idempotent — a second run finds nothing to do", async () => {
    const venueId = oid();
    await mongoose.connection.db
      .collection("venues")
      .insertOne({ _id: venueId, name: "Arena", address: "1 Road" });
    await insertLegacyBooking({ venueId });

    await migration29({ apply: true });
    const second = await migration29({ apply: true });

    assert.equal(second.planned, 0);
  });

  it("does not overwrite a delivery the application already wrote", async () => {
    const venueId = oid();
    await mongoose.connection.db.collection("venues").insertOne({
      _id: venueId,
      name: "Arena",
      address: "TODAY's address after the venue moved",
    });
    const bookingId = await insertLegacyBooking({
      venueId,
      delivery: {
        kind: "PLATFORM_VENUE",
        venueId,
        addressSnapshot: "the address when the booking was sold",
      },
    });

    await migration29({ apply: true });

    const row = await mongoose.connection.db
      .collection("bookings")
      .findOne({ _id: bookingId });
    assert.equal(
      row.delivery.addressSnapshot,
      "the address when the booking was sold",
    );
  });
});
