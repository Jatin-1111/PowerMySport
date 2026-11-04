/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for ExperienceNudgeService — the daily sweep that turns a
// completed booking into a "share your experience?" prompt. In-memory
// MongoDB, same reasoning as blogRoutes.integration.test.ts: local dev points
// at the live cluster, so a test on the default connection would write to
// production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { ScheduledNotification } = require("../client/models/ScheduledNotification");
const { ExperienceNudgeService } = require("../client/services/ExperienceNudgeService");

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  for (const name of [
    "users",
    "bookings",
    "expertsessions",
    "experts",
    "venues",
    "academies",
    "coaches",
    "schedulednotifications",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0); // midday, safely inside the target day's window
  return d;
};

const seedUser = async (overrides: Record<string, unknown> = {}) => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Test",
    email: `${userId.toString()}@example.test`,
    phone: `9${userId.toString().slice(-9)}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
    ...overrides,
  });
  return userId;
};

const seedVenue = async (name = "Test Sports Arena") => {
  const venueId = oid();
  await mongoose.connection.db.collection("venues").insertOne({ _id: venueId, name });
  return venueId;
};

const seedCompletedBooking = async (fields: Record<string, unknown>) => {
  const bookingId = oid();
  await mongoose.connection.db.collection("bookings").insertOne({
    _id: bookingId,
    status: "COMPLETED",
    ...fields,
  });
  return bookingId;
};

describe("ExperienceNudgeService.sweep", () => {
  it("nudges a venue booking completed exactly N days ago", async () => {
    const userId = await seedUser();
    const venueId = await seedVenue("Green Turf Arena");
    await seedCompletedBooking({
      userId,
      providerType: "VENUE",
      venueId,
      completedAt: daysAgo(2),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 1);

    const nudge = await ScheduledNotification.findOne({ type: "EXPERIENCE_NUDGE" }).lean();
    assert.ok(nudge, "a nudge should have been created");
    assert.equal(String(nudge.userId), String(userId));
    assert.equal(nudge.data.subjectKind, "VENUE");
    assert.equal(nudge.data.subjectRefId, String(venueId));
    assert.equal(nudge.data.subjectName, "Green Turf Arena");
    assert.ok(nudge.data.url.includes("subjectKind=VENUE"));
    assert.equal(nudge.status, "PENDING");
  });

  it("ignores a booking that completed today, not N days ago", async () => {
    const userId = await seedUser();
    const venueId = await seedVenue();
    await seedCompletedBooking({
      userId,
      providerType: "VENUE",
      venueId,
      completedAt: daysAgo(0),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 0);
  });

  it("does not nudge the same booking twice", async () => {
    const userId = await seedUser();
    const venueId = await seedVenue();
    await seedCompletedBooking({
      userId,
      providerType: "VENUE",
      venueId,
      completedAt: daysAgo(2),
    });

    const first = await ExperienceNudgeService.sweep(2);
    assert.equal(first.created, 1);

    const second = await ExperienceNudgeService.sweep(2);
    assert.equal(second.created, 0, "re-running the sweep must not duplicate the nudge");

    const count = await ScheduledNotification.countDocuments({ type: "EXPERIENCE_NUDGE" });
    assert.equal(count, 1);
  });

  it("skips a user who has turned off in-app booking reminders", async () => {
    const userId = await seedUser({
      notificationPreferences: { inApp: { bookingReminders: false } },
    });
    const venueId = await seedVenue();
    await seedCompletedBooking({
      userId,
      providerType: "VENUE",
      venueId,
      completedAt: daysAgo(2),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 0);
  });

  it("resolves an academy booking's name and slug", async () => {
    const userId = await seedUser();
    const academyId = oid();
    await mongoose.connection.db
      .collection("academies")
      .insertOne({ _id: academyId, name: "Ace Tennis Academy", slug: "ace-tennis-academy" });
    await seedCompletedBooking({
      userId,
      providerType: "ACADEMY",
      academyId,
      completedAt: daysAgo(2),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 1);

    const nudge = await ScheduledNotification.findOne({ type: "EXPERIENCE_NUDGE" }).lean();
    assert.equal(nudge.data.subjectKind, "ACADEMY");
    assert.equal(nudge.data.subjectName, "Ace Tennis Academy");
    assert.equal(nudge.data.subjectSlug, "ace-tennis-academy");
  });

  it("resolves a coach booking's name via the coach's own user", async () => {
    const userId = await seedUser();
    const coachUserId = await seedUser({ role: "Coach", name: "Coach Mehta" });
    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: coachUserId, isVerified: true });
    await seedCompletedBooking({
      userId,
      providerType: "COACH",
      coachId,
      completedAt: daysAgo(2),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 1);

    const nudge = await ScheduledNotification.findOne({ type: "EXPERIENCE_NUDGE" }).lean();
    assert.equal(nudge.data.subjectKind, "COACH");
    assert.equal(nudge.data.subjectName, "Coach Mehta");
  });

  it("nudges a completed expert session", async () => {
    const userId = await seedUser();
    const expertUserId = await seedUser({ role: "Coach", name: "Dr. Sharma" });
    const expertId = oid();
    await mongoose.connection.db
      .collection("experts")
      .insertOne({ _id: expertId, userId: expertUserId, isActive: true });
    await mongoose.connection.db.collection("expertsessions").insertOne({
      _id: oid(),
      userId,
      expertId,
      status: "COMPLETED",
      completedAt: daysAgo(2),
    });

    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 1);

    const nudge = await ScheduledNotification.findOne({ type: "EXPERIENCE_NUDGE" }).lean();
    assert.equal(nudge.data.subjectKind, "EXPERT");
    assert.equal(nudge.data.subjectName, "Dr. Sharma");
  });

  it("does nothing for a tournament — there is no attendance record to nudge from", async () => {
    // No seed needed: this documents the deliberate scope limit rather than
    // exercising a code path. collectFromBookings/collectFromExpertBookings
    // have no TOURNAMENT/TOURNAMENT_EDITION branch at all.
    const { created } = await ExperienceNudgeService.sweep(2);
    assert.equal(created, 0);
  });
});
