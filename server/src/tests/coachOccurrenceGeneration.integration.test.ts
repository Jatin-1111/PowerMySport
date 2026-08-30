/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for materialising a coach's weekly pattern into sessions,
// and for the online-delivery behaviour built on top of it. In-memory MongoDB.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CoachOffering } = require("../client/models/CoachOffering");
const { CoachEnrollment } = require("../client/models/CoachEnrollment");
const { CoachSessionCredit } = require("../client/models/CoachSessionCredit");
const {
  CoachSessionOccurrence,
} = require("../client/models/CoachSessionOccurrence");
const {
  CoachSubscriptionPackage,
} = require("../client/models/CoachSubscriptionPackage");
const { Coach } = require("../client/models/Coach");
const occurrences = require("../client/services/CoachOccurrenceService");
const offeringService = require("../client/services/CoachOfferingService");
const reminders = require("../client/services/CoachSessionReminderService");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    CoachOffering.syncIndexes(),
    CoachSessionOccurrence.syncIndexes(),
    CoachEnrollment.syncIndexes(),
    CoachSessionCredit.syncIndexes(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of [
    "coachofferings",
    "coachenrollments",
    "coachsessioncredits",
    "coachsessionoccurrences",
    "coachsubscriptionpackages",
    "coaches",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const NOW = new Date("2026-09-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-10-01T00:00:00.000Z");

const seedOffering = async (overrides: Record<string, unknown> = {}) => {
  const coachId = oid();
  const pkg = await CoachSubscriptionPackage.create({
    coachId,
    name: "Monthly",
    frequency: "MONTHLY",
    price: 400000,
    maxSessions: 8,
    maxStudents: 6,
  });

  const offering = await CoachOffering.create({
    coachId,
    sport: "Chess",
    title: "Evening chess",
    deliveryKind: "PROVIDER_VENUE",
    capacity: 4,
    schedule: [
      { dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 },
      { dayOfWeek: 4, startTime: "18:00", durationMinutes: 60 },
    ],
    timezone: "Asia/Kolkata",
    packageId: pkg._id,
    startDate: NOW,
    status: "ACTIVE",
    ...overrides,
  });

  return { coachId, pkg, offering };
};

/**
 * Enrol a student the way the real flow does: hold a seat, then activate it as
 * the payment reconciliation would. Reserving alone grants nothing.
 */
const enrollPaid = async (offering: any, studentName: string) => {
  const enrollment = await offeringService.reserveEnrollmentSeat({
    offeringId: offering._id,
    userId: oid(),
    studentName,
    now: new Date("2026-08-31T00:00:00.000Z"),
  });

  return offeringService.activateEnrollmentAfterPayment({
    enrollmentId: enrollment._id,
    subscriptionId: oid(),
    periodStart: NOW,
    periodEnd: PERIOD_END,
    feePaise: 400000,
    now: new Date("2026-08-31T00:00:00.000Z"),
  });
};

describe("generating sessions from a weekly pattern", () => {
  it("materialises the window as instants", async () => {
    const { offering } = await seedOffering();

    const result = await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    assert.equal(result.created, 4);

    const created = await CoachSessionOccurrence.find({}).sort({
      scheduledAt: 1,
    });
    assert.equal(
      created[0].scheduledAt.toISOString(),
      "2026-09-01T12:30:00.000Z",
      "18:00 IST must be stored as 12:30 UTC",
    );
  });

  it("is idempotent — a second run creates nothing new", async () => {
    const { offering } = await seedOffering();
    const through = new Date("2026-09-15T00:00:00.000Z");

    await occurrences.generateOccurrences({ offering, now: NOW, through });
    const reloaded = await CoachOffering.findById(offering._id);
    const second = await occurrences.generateOccurrences({
      offering: reloaded,
      now: NOW,
      through,
    });

    assert.equal(second.created, 0);
    assert.equal(await CoachSessionOccurrence.countDocuments({}), 4);
  });

  it("does not duplicate sessions when two generators race", async () => {
    // The (offeringId, scheduledAt) unique index is the real guard; the service
    // treats a duplicate-key error as "already generated".
    const { offering } = await seedOffering();
    const through = new Date("2026-09-15T00:00:00.000Z");

    await Promise.all([
      occurrences.generateOccurrences({ offering, now: NOW, through }),
      occurrences.generateOccurrences({ offering, now: NOW, through }),
    ]);

    assert.equal(await CoachSessionOccurrence.countDocuments({}), 4);
  });

  it("generates nothing for a paused programme", async () => {
    const { offering } = await seedOffering({ status: "PAUSED" });

    const result = await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    assert.equal(result.created, 0);
  });

  it("leaves history alone when the programme is paused", async () => {
    const { offering } = await seedOffering();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    // Deliver one session, then pause.
    const first = await CoachSessionOccurrence.findOne({}).sort({
      scheduledAt: 1,
    });
    first.status = "COMPLETED";
    await first.save();

    await offeringService.pauseOffering({
      offeringId: offering._id,
      now: NOW,
    });

    const survivors = await CoachSessionOccurrence.find({});
    assert.equal(survivors.length, 1, "a completed session was deleted");
    assert.equal(survivors[0].status, "COMPLETED");
  });
});

describe("rosters", () => {
  it("puts newly enrolled students onto sessions that have not happened", async () => {
    const { offering } = await seedOffering();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    // Nobody is enrolled yet, so every roster is empty.
    let sessions = await CoachSessionOccurrence.find({});
    assert.ok(sessions.every((s: any) => s.roster.length === 0));

    await enrollPaid(offering, "Late Joiner");

    sessions = await CoachSessionOccurrence.find({});
    assert.ok(
      sessions.every((s: any) => s.roster.length === 1),
      "enrolling did not add the student to upcoming sessions",
    );
  });

  it("never rewrites the roster of a session that already happened", async () => {
    const { offering } = await seedOffering();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    const past = await CoachSessionOccurrence.findOne({}).sort({
      scheduledAt: 1,
    });
    past.status = "COMPLETED";
    past.roster = [];
    await past.save();

    await enrollPaid(offering, "Later Student");

    const reloaded = await CoachSessionOccurrence.findById(past._id);
    assert.equal(
      reloaded.roster.length,
      0,
      "a completed session's attendance record was rewritten",
    );
  });
});

describe("online delivery", () => {
  const seedOnline = async (overrides: Record<string, unknown> = {}) =>
    seedOffering({
      deliveryKind: "ONLINE",
      onlinePlatform: "Zoom",
      defaultMeetingLink: "https://zoom.example/abc",
      ...overrides,
    });

  it("copies the room link onto each generated session", async () => {
    const { offering } = await seedOnline();

    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-08T00:00:00.000Z"),
    });

    const session = await CoachSessionOccurrence.findOne({});
    assert.equal(session.delivery.kind, "ONLINE");
    assert.equal(session.delivery.platform, "Zoom");
    assert.equal(session.delivery.meetingLink, "https://zoom.example/abc");
  });

  it("rolls a new link forward without rewriting sessions already delivered", async () => {
    const { offering } = await seedOnline();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-15T00:00:00.000Z"),
    });

    const past = await CoachSessionOccurrence.findOne({}).sort({
      scheduledAt: 1,
    });
    past.status = "COMPLETED";
    await past.save();

    const result = await occurrences.setOfferingMeetingLink({
      offeringId: offering._id,
      meetingLink: "https://zoom.example/new",
      now: NOW,
    });

    assert.equal(result.updatedSessions, 3);

    const reloadedPast = await CoachSessionOccurrence.findById(past._id);
    assert.equal(
      reloadedPast.delivery.meetingLink,
      "https://zoom.example/abc",
      "a delivered session's link was rewritten",
    );
  });

  it("refuses to change the link on a session that already happened", async () => {
    const { offering } = await seedOnline();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-08T00:00:00.000Z"),
    });

    const session = await CoachSessionOccurrence.findOne({});
    session.status = "COMPLETED";
    await session.save();

    await assert.rejects(
      () =>
        occurrences.setOccurrenceMeetingLink({
          occurrenceId: session._id,
          meetingLink: "https://zoom.example/other",
        }),
      /has not happened yet/,
    );
  });

  it("refuses a meeting link on an in-person session", async () => {
    const { offering } = await seedOffering();
    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-08T00:00:00.000Z"),
    });

    const session = await CoachSessionOccurrence.findOne({});
    await assert.rejects(
      () =>
        occurrences.setOccurrenceMeetingLink({
          occurrenceId: session._id,
          meetingLink: "https://zoom.example/x",
        }),
      /Only an online session/,
    );
  });
});

describe("class-link nudges", () => {
  const seedLinkless = async () => {
    const coachId = oid();
    await Coach.collection.insertOne({
      _id: coachId,
      userId: oid(),
      sports: ["Chess"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
    });

    const pkg = await CoachSubscriptionPackage.create({
      coachId,
      name: "Monthly",
      frequency: "MONTHLY",
      price: 400000,
      maxSessions: 8,
    });

    const offering = await CoachOffering.create({
      coachId,
      sport: "Chess",
      title: "Online chess",
      deliveryKind: "ONLINE",
      onlinePlatform: "Zoom",
      capacity: 4,
      schedule: [{ dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 }],
      packageId: pkg._id,
      startDate: NOW,
      status: "ACTIVE",
    });

    await occurrences.generateOccurrences({
      offering,
      now: NOW,
      through: new Date("2026-09-08T00:00:00.000Z"),
    });

    return { coachId, offering };
  };

  it("nudges the coach when an online class is soon and has no link", async () => {
    await seedLinkless();

    const sent = await reminders.sendCoachMeetingLinkNudges({
      now: new Date("2026-09-01T11:00:00.000Z"),
    });

    assert.equal(sent, 1);
  });

  it("only nudges once", async () => {
    await seedLinkless();
    const now = new Date("2026-09-01T11:00:00.000Z");

    await reminders.sendCoachMeetingLinkNudges({ now });
    const second = await reminders.sendCoachMeetingLinkNudges({ now });

    assert.equal(second, 0);
  });

  it("does not nudge when the link is already there", async () => {
    const { offering } = await seedLinkless();
    await occurrences.setOfferingMeetingLink({
      offeringId: offering._id,
      meetingLink: "https://zoom.example/ok",
      now: NOW,
    });

    const sent = await reminders.sendCoachMeetingLinkNudges({
      now: new Date("2026-09-01T11:00:00.000Z"),
    });

    assert.equal(sent, 0);
  });

  it("does not nudge for a class that is still days away", async () => {
    await seedLinkless();

    const sent = await reminders.sendCoachMeetingLinkNudges({
      now: new Date("2026-08-30T11:00:00.000Z"),
    });

    assert.equal(sent, 0);
  });
});
