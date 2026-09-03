/* eslint-disable @typescript-eslint/no-var-requires */
// Characterization tests for the expert session lifecycle.
//
// WHY THESE EXIST
// ---------------
// Stage 3 of the booking unification moves expert sessions out of the
// ExpertSession collection and into the unified Booking model. That means
// rewriting ~300 field accesses across payment, refund and payout logic — in a
// service that had zero behavioural coverage, against a database that is also
// production.
//
// These tests pin what the service does TODAY. They are deliberately written
// against the public service functions and assert on observable outcomes
// (statuses, money, who-can-do-what), not on storage details, so the same
// suite must keep passing once the storage swaps to Booking. They are the
// contract for that cutover.
//
// Where current behaviour is arguably wrong, it is pinned as-is and flagged in
// a comment rather than silently "fixed" — a characterization suite that
// encodes what you wish the code did is worse than none.
//
// HOW TO RUN
// ----------
//   npm run test:expert-lifecycle   (or `npm test` for everything)
//
// It must go through the build. The scripts compile to `dist/` because tsconfig
// targets CommonJS, and `mock.method` below depends on that: it replaces a
// property by rewriting its descriptor, which only works on the writable data
// properties CJS `exports` produces. Running the TypeScript directly with a
// loader that emits ESM instead (`npx tsx --test src/tests/...`) makes
// `require()` return a module namespace whose exports are non-configurable
// GETTERS — the descriptor then has no `.value`, and every mock.method call dies
// in `before()` with:
//
//   TypeError [ERR_INVALID_ARG_VALUE]: The argument 'methodName' must be a
//   method. Received undefined
//
// which cancels the whole file and reports a cheerful `pass 0, fail 0`.

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
// A REPLICA SET, not a standalone: expert session creation reserves its slot
// inside a transaction (withExpertSlotLock), and MongoDB rejects transactions
// outside a replica set. A standalone instance fails every creation path with
// "Transaction numbers are only allowed on a replica set member or mongos".
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const PhonePeService = require("../shared/services/PhonePeService");
const ExpertsService = require("../client/services/ExpertsService");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Expert } = require("../client/models/ExpertProfile");
const { User } = require("../client/models/User");
const { BookingSlotLock } = require("../client/models/BookingSlotLock");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let phonepeStatus: any = { state: "PENDING" };

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  mock.method(PhonePeService, "initiatePhonePePayment", async () => ({
    redirectUrl: "https://phonepe.test/pay",
  }));
  mock.method(PhonePeService, "getPhonePeOrderStatus", async () => phonepeStatus);
  mock.method(PhonePeService, "initiatePhonePeRefund", async () => ({
    refundId: "R_TEST",
    state: "INITIATED",
  }));
});

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  phonepeStatus = { state: "PENDING" };
  await ExpertSession.collection.deleteMany({});
  await Expert.collection.deleteMany({});
  await User.collection.deleteMany({});
  await BookingSlotLock.collection.deleteMany({});
});

/**
 * A far-future slot so nothing trips the "already happened" guards.
 *
 * 05:30 UTC is exactly 11:00 IST. That matters: assertSlotBookable only accepts
 * an instant that lands on the expert's slot grid, which starts at the
 * availability window's start and steps by sessionDurationMinutes. With a
 * 00:00 window and 60-minute sessions, only whole IST hours are bookable — so
 * a UTC time whose minutes are :30 is required, not optional.
 */
const futureSlot = (daysAhead = 30): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(5, 30, 0, 0); // 11:00 IST
  return d;
};

const seedExpert = async (overrides: Record<string, unknown> = {}) => {
  const expertUserId = oid();
  await User.collection.insertOne({
    _id: expertUserId,
    name: "Expert Person",
    email: `expert-${expertUserId}@test.com`,
    phone: "9000000001",
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
    // Open every day, all day — availability itself is not what these tests pin.
    weeklyAvailability: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      start: "00:00",
      end: "23:59",
    })),
    blackoutDates: [],
    isActive: true,
    verificationStatus: "APPROVED",
    rating: 0,
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  return { expertId: expertId.toString(), expertUserId: expertUserId.toString() };
};

const seedClient = async () => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: "9000000002",
    role: "Parent",
    password: "x",
  });
  return userId.toString();
};

/** Create a session and optionally drive it to paid. */
const createSession = async (opts: { paid?: boolean } = {}) => {
  const { expertId, expertUserId } = await seedExpert();
  const userId = await seedClient();
  const scheduledAt = futureSlot();

  const created = await ExpertsService.initiateExpertSession({
    expertId,
    userId,
    scheduledAt: scheduledAt.toISOString(),
    mode: "ONLINE",
  });

  if (opts.paid) {
    phonepeStatus = { state: "COMPLETED" };
    await ExpertsService.reconcileExpertSession({
      sessionId: created.sessionId,
      userId,
    });
  }

  return {
    sessionId: created.sessionId,
    expertId,
    expertUserId,
    userId,
    scheduledAt,
  };
};

const load = async (sessionId: string) => ExpertSession.findById(sessionId).lean();

// ───────────────── creation & payment ─────────────────
describe("creating an expert session", () => {
  it("starts as an unpaid hold with an expiry and a redirect url", async () => {
    const { sessionId } = await createSession();
    const session = await load(sessionId);

    assert.equal(session.status, "PENDING_PAYMENT");
    assert.equal(session.paymentStatus, "PENDING");
    assert.equal(session.expertAcceptance, "PENDING");
    assert.equal(session.amount, 1000, "amount is stored in RUPEES");
    assert.ok(session.holdExpiresAt, "an unpaid hold must expire");
    assert.match(session.merchantOrderId, /^EXP_/);
  });

  it("refuses a self-booking", async () => {
    const { expertId, expertUserId } = await seedExpert();
    await assert.rejects(
      () =>
        ExpertsService.initiateExpertSession({
          expertId,
          userId: expertUserId,
          scheduledAt: futureSlot().toISOString(),
        }),
      /cannot book a session with yourself/i
    );
  });

  it("refuses an inactive expert", async () => {
    const { expertId } = await seedExpert({ isActive: false });
    const userId = await seedClient();
    await assert.rejects(
      () =>
        ExpertsService.initiateExpertSession({
          expertId,
          userId,
          scheduledAt: futureSlot().toISOString(),
        }),
      /Expert not found/
    );
  });

  it("confirms payment, clears the hold, and schedules", async () => {
    const { sessionId } = await createSession({ paid: true });
    const session = await load(sessionId);

    assert.equal(session.paymentStatus, "COMPLETED");
    assert.equal(session.status, "SCHEDULED");
    assert.ok(session.paidAt);
    assert.equal(session.holdExpiresAt, undefined, "hold must be released");
  });

  it("is idempotent when payment is reconciled twice", async () => {
    const { sessionId, userId } = await createSession({ paid: true });
    const first = await load(sessionId);

    await ExpertsService.reconcileExpertSession({ sessionId, userId });
    const second = await load(sessionId);

    assert.equal(second.status, first.status);
    assert.deepEqual(second.paidAt, first.paidAt, "paidAt must not move");
  });

  it("cancels the session when the gateway reports failure", async () => {
    const { sessionId, userId } = await createSession();
    phonepeStatus = { state: "FAILED" };

    await ExpertsService.reconcileExpertSession({ sessionId, userId });
    const session = await load(sessionId);

    assert.equal(session.paymentStatus, "FAILED");
    assert.equal(session.status, "CANCELLED");
    assert.equal(session.cancelledBy, "SYSTEM");
  });
});

// ───────────────── expert response ─────────────────
describe("expert responding to a booked session", () => {
  it("ACCEPT records acceptance and who responded when", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });

    await ExpertsService.respondToExpertSession({
      sessionId,
      expertUserId,
      action: "ACCEPT",
    });
    const session = await load(sessionId);

    assert.equal(session.expertAcceptance, "ACCEPTED");
    assert.equal(session.status, "SCHEDULED");
    assert.ok(session.expertRespondedAt);
  });

  it("DECLINE cancels the session and flags a manual refund on a paid one", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });

    await ExpertsService.respondToExpertSession({
      sessionId,
      expertUserId,
      action: "DECLINE",
      reason: "unavailable",
    });
    const session = await load(sessionId);

    assert.equal(session.status, "CANCELLED");
    assert.equal(session.expertAcceptance, "DECLINED");
    assert.equal(session.cancelledBy, "EXPERT");
    assert.equal(session.refundStatus, "REQUIRED", "a paid decline owes the customer money");
    assert.ok(
      typeof session.cancellationNoticeHours === "number",
      "notice given is recorded for admin to judge the refund"
    );
  });

  it("refuses a response from someone who is not the expert", async () => {
    const { sessionId } = await createSession({ paid: true });
    await assert.rejects(
      () =>
        ExpertsService.respondToExpertSession({
          sessionId,
          expertUserId: oid().toString(),
          action: "ACCEPT",
        }),
      /Only the expert or an admin/
    );
  });

  it("refuses to modify a session that is no longer live", async () => {
    const { sessionId, expertUserId, userId } = await createSession({
      paid: true,
    });
    await ExpertsService.cancelExpertSession({
      sessionId,
      actorUserId: userId,
    });

    await assert.rejects(
      () =>
        ExpertsService.respondToExpertSession({
          sessionId,
          expertUserId,
          action: "ACCEPT",
        }),
      /can no longer be modified/
    );
  });
});

// ───────────────── completion ─────────────────
describe("completing a session", () => {
  const MOM = "We covered the training plan and agreed on next steps.";

  it("requires minutes of meeting and stamps completedAt", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    // Admin override is needed because the slot is in the future.
    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: MOM,
    });
    const session = await load(sessionId);

    assert.equal(session.status, "COMPLETED");
    assert.equal(session.momNotes, MOM);
    assert.ok(session.momAddedAt);
    assert.ok(
      session.completedAt,
      "completedAt anchors the 24h payout window and must be distinct from updatedAt"
    );
    assert.equal(session.payoutStatus, "PENDING");
  });

  it("rejects a too-short MOM", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await assert.rejects(
      () =>
        ExpertsService.completeExpertSession({
          sessionId,
          actorUserId: expertUserId,
          isAdmin: true,
          momNotes: "done",
        }),
      /at least \d+ characters/
    );
  });

  it("refuses completion before the session has started (non-admin)", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await assert.rejects(
      () =>
        ExpertsService.completeExpertSession({
          sessionId,
          actorUserId: expertUserId,
          momNotes: MOM,
        }),
      /only complete a session once it has started/i
    );
  });

  it("lets the expert revise MOM afterwards without moving momAddedAt", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: MOM,
    });
    const before = await load(sessionId);

    const revised = `${MOM} Also discussed nutrition.`;
    await ExpertsService.updateExpertSessionMom({
      sessionId,
      actorUserId: expertUserId,
      momNotes: revised,
    });
    const after = await load(sessionId);

    assert.equal(after.momNotes, revised);
    assert.deepEqual(after.momAddedAt, before.momAddedAt);
  });
});

// ───────────────── cancellation ─────────────────
describe("cancelling a session", () => {
  it("records who cancelled and requires a manual refund when paid", async () => {
    const { sessionId, userId } = await createSession({ paid: true });

    await ExpertsService.cancelExpertSession({
      sessionId,
      actorUserId: userId,
      reason: "clash",
    });
    const session = await load(sessionId);

    assert.equal(session.status, "CANCELLED");
    assert.equal(session.cancelledBy, "CLIENT");
    assert.equal(session.refundStatus, "REQUIRED");
    assert.equal(session.cancelReason, "clash");
  });

  it("attributes an expert-initiated cancellation to EXPERT", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await ExpertsService.cancelExpertSession({
      sessionId,
      actorUserId: expertUserId,
    });
    assert.equal((await load(sessionId)).cancelledBy, "EXPERT");
  });

  it("refuses cancellation by an unrelated user", async () => {
    const { sessionId } = await createSession({ paid: true });
    await assert.rejects(
      () =>
        ExpertsService.cancelExpertSession({
          sessionId,
          actorUserId: oid().toString(),
        }),
      /not authorized/i
    );
  });

  it("refuses to cancel a completed session", async () => {
    const { sessionId, expertUserId, userId } = await createSession({
      paid: true,
    });
    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: "A full and complete set of session notes here.",
    });

    await assert.rejects(
      () => ExpertsService.cancelExpertSession({ sessionId, actorUserId: userId }),
      /completed session cannot be cancelled/i
    );
  });

  it("is a no-op when already cancelled", async () => {
    const { sessionId, userId } = await createSession({ paid: true });
    await ExpertsService.cancelExpertSession({ sessionId, actorUserId: userId });
    const first = await load(sessionId);

    await ExpertsService.cancelExpertSession({ sessionId, actorUserId: userId });
    const second = await load(sessionId);

    assert.deepEqual(second.cancelledAt, first.cancelledAt);
  });
});

// ───────────────── money out ─────────────────
describe("refund and payout", () => {
  it("marks a required refund as manually done", async () => {
    const { sessionId, userId } = await createSession({ paid: true });
    await ExpertsService.cancelExpertSession({ sessionId, actorUserId: userId });

    await ExpertsService.markSessionRefundDone(sessionId);

    assert.equal((await load(sessionId)).refundStatus, "MANUAL_DONE");
  });

  it("refuses to mark a refund done when none is required", async () => {
    const { sessionId } = await createSession({ paid: true });
    await assert.rejects(
      () => ExpertsService.markSessionRefundDone(sessionId),
      /no pending refund/i
    );
  });

  it("releases a payout only for a completed, paid session", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });

    await assert.rejects(
      () => ExpertsService.markSessionPayoutDone(sessionId),
      /no payout to release/i
    );

    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: "A full and complete set of session notes here.",
    });
    await ExpertsService.markSessionPayoutDone(sessionId);

    const session = await load(sessionId);
    assert.equal(session.payoutStatus, "PAID");
    assert.ok(session.payoutPaidAt);
  });

  it("refuses to pay out twice", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: "A full and complete set of session notes here.",
    });
    await ExpertsService.markSessionPayoutDone(sessionId);

    await assert.rejects(
      () => ExpertsService.markSessionPayoutDone(sessionId),
      /already been marked paid/i
    );
  });

  it("auto-releases payouts only 24h after completion", async () => {
    const { sessionId, expertUserId } = await createSession({ paid: true });
    await ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: "A full and complete set of session notes here.",
    });

    assert.equal(
      await ExpertsService.releaseExpertSessionPayouts(),
      0,
      "a just-completed session is not yet eligible"
    );

    await ExpertSession.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { $set: { completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } }
    );

    assert.equal(await ExpertsService.releaseExpertSessionPayouts(), 1);
    assert.equal((await load(sessionId)).payoutStatus, "PAID");
  });
});

// ───────────────── reviews ─────────────────
describe("reviewing a session", () => {
  const completeIt = async (sessionId: string, expertUserId: string) =>
    ExpertsService.completeExpertSession({
      sessionId,
      actorUserId: expertUserId,
      isAdmin: true,
      momNotes: "A full and complete set of session notes here.",
    });

  it("stores the rating and updates the expert's aggregate", async () => {
    const { sessionId, expertUserId, userId, expertId } = await createSession({
      paid: true,
    });
    await completeIt(sessionId, expertUserId);

    await ExpertsService.reviewExpertSession({
      sessionId,
      userId,
      rating: 5,
      review: "Excellent",
    });

    const session = await load(sessionId);
    assert.equal(session.reviewed, true);
    assert.equal(session.rating, 5);

    const expert = await Expert.findById(expertId).lean();
    assert.equal(expert.rating, 5);
    assert.equal(expert.reviewCount, 1);
  });

  it("refuses a second review", async () => {
    const { sessionId, expertUserId, userId } = await createSession({
      paid: true,
    });
    await completeIt(sessionId, expertUserId);
    await ExpertsService.reviewExpertSession({ sessionId, userId, rating: 4 });

    await assert.rejects(
      () => ExpertsService.reviewExpertSession({ sessionId, userId, rating: 5 }),
      /already reviewed/i
    );
  });

  it("refuses to review an incomplete session and rejects out-of-range ratings", async () => {
    const { sessionId, expertUserId, userId } = await createSession({
      paid: true,
    });

    await assert.rejects(
      () => ExpertsService.reviewExpertSession({ sessionId, userId, rating: 5 }),
      /only review a completed session/i
    );

    await completeIt(sessionId, expertUserId);
    await assert.rejects(
      () => ExpertsService.reviewExpertSession({ sessionId, userId, rating: 6 }),
      /between 1 and 5/
    );
  });
});

// ───────────────── hold expiry ─────────────────
describe("unpaid hold expiry", () => {
  const expire = async (sessionId: string) =>
    ExpertSession.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { $set: { holdExpiresAt: new Date(Date.now() - 60_000) } }
    );

  it("cancels a lapsed unpaid hold with the exact system reason", async () => {
    const { sessionId } = await createSession();
    await expire(sessionId);
    phonepeStatus = { state: "PENDING" };

    assert.equal(await ExpertsService.expireUnpaidExpertHolds(), 1);

    const session = await load(sessionId);
    assert.equal(session.status, "CANCELLED");
    assert.equal(session.cancelledBy, "SYSTEM");
    // The unified mapping keys EXPIRED off this exact string — see
    // utils/expertSessionMapping.ts HOLD_EXPIRY_REASON.
    assert.equal(session.cancelReason, "Payment not completed in time");
  });

  it("rescues a hold whose payment actually succeeded", async () => {
    // The critical safety case: never write off a captured payment just
    // because the client-side reconcile never ran.
    const { sessionId } = await createSession();
    await expire(sessionId);
    phonepeStatus = { state: "COMPLETED" };

    assert.equal(await ExpertsService.expireUnpaidExpertHolds(), 0);

    const session = await load(sessionId);
    assert.equal(session.paymentStatus, "COMPLETED");
    assert.notEqual(session.status, "CANCELLED");
  });

  it("leaves a hold that has not lapsed", async () => {
    const { sessionId } = await createSession();
    assert.equal(await ExpertsService.expireUnpaidExpertHolds(), 0);
    assert.equal((await load(sessionId)).status, "PENDING_PAYMENT");
  });
});
