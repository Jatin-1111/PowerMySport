/* eslint-disable @typescript-eslint/no-var-requires */
// An expert may open a child's full profile (date of birth, medical conditions,
// height, weight) only for a session that was paid for, was not cancelled or
// declined, and ended no more than CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION days
// ago. The detail view used to check only that the caller owned the session, so
// an unpaid hold, a cancelled session or a booking from last year all exposed it.
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

const {
  assertExpertMayReadChildProfile,
  getExpertSessionPlayerDetail,
  CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION,
} = require("../client/services/ExpertsService/sessionQueries");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Expert } = require("../client/models/ExpertProfile");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60_000;

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
  await ExpertSession.collection.deleteMany({});
  await Expert.collection.deleteMany({});
  await Player.collection.deleteMany({});
  await User.collection.deleteMany({});
});

/** A paid, scheduled session that starts `startsInDays` from now (negative = already past). */
const paidSession = (startsInDays: number, overrides: Record<string, unknown> = {}) => ({
  paymentStatus: "COMPLETED",
  status: "SCHEDULED",
  expertAcceptance: "ACCEPTED",
  scheduledAt: new Date(Date.now() + startsInDays * DAY),
  durationMinutes: 60,
  ...overrides,
});

describe("assertExpertMayReadChildProfile", () => {
  it("allows a paid, accepted session that has not happened yet", () => {
    assert.doesNotThrow(() => assertExpertMayReadChildProfile(paidSession(3)));
  });

  it("allows a paid session that is still pending the expert's acceptance", () => {
    assert.doesNotThrow(() =>
      assertExpertMayReadChildProfile(paidSession(3, { expertAcceptance: "PENDING" }))
    );
  });

  it("refuses an unpaid hold", () => {
    assert.throws(
      () =>
        assertExpertMayReadChildProfile(
          paidSession(3, { paymentStatus: "PENDING", status: "PENDING_PAYMENT" })
        ),
      /paid for/
    );
  });

  it("refuses a failed payment", () => {
    assert.throws(
      () => assertExpertMayReadChildProfile(paidSession(3, { paymentStatus: "FAILED" })),
      /paid for/
    );
  });

  it("refuses a cancelled session even though it was paid", () => {
    assert.throws(
      () => assertExpertMayReadChildProfile(paidSession(3, { status: "CANCELLED" })),
      /cancelled or declined/
    );
  });

  it("refuses a session the expert declined", () => {
    assert.throws(
      () => assertExpertMayReadChildProfile(paidSession(3, { expertAcceptance: "DECLINED" })),
      /cancelled or declined/
    );
  });

  it("refuses a paid session with no scheduled time", () => {
    assert.throws(
      () => assertExpertMayReadChildProfile(paidSession(3, { scheduledAt: undefined })),
      /scheduled time/
    );
  });

  it("stays open until the window after the session closes, then shuts", () => {
    const longAgo = -(CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION + 1);
    const justInside = -(CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION - 1);
    assert.doesNotThrow(() => assertExpertMayReadChildProfile(paidSession(justInside)));
    assert.throws(
      () => assertExpertMayReadChildProfile(paidSession(longAgo)),
      new RegExp(`${CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION} days`)
    );
  });

  it("counts the window from the end of the session, not its start", () => {
    // Starts 14 days ago but runs 3 days: it ended 11 days ago, so still inside.
    const startedFourteenDaysAgo = paidSession(-CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION, {
      durationMinutes: 3 * 24 * 60,
    });
    assert.doesNotThrow(() => assertExpertMayReadChildProfile(startedFourteenDaysAgo));
  });
});

describe("getExpertSessionPlayerDetail", () => {
  let phoneCounter = 0;
  const seed = async (session: Record<string, unknown>) => {
    const expertUserId = oid();
    await User.collection.insertOne({
      _id: expertUserId,
      name: "Expert Person",
      email: `expert-${expertUserId}@test.com`,
      phone: `9${String(++phoneCounter).padStart(9, "0")}`,
      role: "EXPERT",
      password: "x",
    });
    const expertId = oid();
    await Expert.collection.insertOne({
      _id: expertId,
      userId: expertUserId,
      bio: "",
      sports: ["Tennis"],
      expertise: [],
      sessionFee: 1000,
      sessionMode: "BOTH",
      sessionDurationMinutes: 60,
      timezone: "Asia/Kolkata",
      weeklyAvailability: [],
      blackoutDates: [],
      isActive: true,
      verificationStatus: "APPROVED",
      rating: 0,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const playerId = oid();
    await Player.collection.insertOne({
      _id: playerId,
      userId: oid(),
      type: "DEPENDENT",
      name: "Aarav",
      age: 11,
      dob: new Date("2015-02-01"),
      medicalConditions: ["asthma"],
    });
    const sessionId = oid();
    await ExpertSession.collection.insertOne({
      _id: sessionId,
      expertId,
      userId: oid(),
      playerId,
      amount: 1000,
      merchantOrderId: `ORDER-${sessionId}`,
      refundStatus: "NONE",
      payoutStatus: "PENDING",
      reviewed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...session,
    });
    return { sessionId: sessionId.toString(), expertUserId: expertUserId.toString() };
  };

  it("returns the child's profile for a paid, upcoming session", async () => {
    const { sessionId, expertUserId } = await seed(paidSession(2));
    const detail = await getExpertSessionPlayerDetail({ sessionId, expertUserId });
    assert.equal(detail.player.name, "Aarav");
    assert.deepEqual(detail.player.medicalConditions, ["asthma"]);
  });

  it("refuses an unpaid hold and returns nothing about the child", async () => {
    const { sessionId, expertUserId } = await seed(
      paidSession(2, { paymentStatus: "PENDING", status: "PENDING_PAYMENT" })
    );
    await assert.rejects(getExpertSessionPlayerDetail({ sessionId, expertUserId }), /paid for/);
  });

  it("refuses a cancelled session", async () => {
    const { sessionId, expertUserId } = await seed(paidSession(2, { status: "CANCELLED" }));
    await assert.rejects(
      getExpertSessionPlayerDetail({ sessionId, expertUserId }),
      /cancelled or declined/
    );
  });

  it("refuses a session that ended long ago", async () => {
    const { sessionId, expertUserId } = await seed(
      paidSession(-(CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION + 5))
    );
    await assert.rejects(getExpertSessionPlayerDetail({ sessionId, expertUserId }), /days after/);
  });

  it("still refuses another expert even for a paid session", async () => {
    const { sessionId } = await seed(paidSession(2));
    const other = await seed(paidSession(2));
    await assert.rejects(
      getExpertSessionPlayerDetail({ sessionId, expertUserId: other.expertUserId }),
      /not authorized/
    );
  });
});
