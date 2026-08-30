/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the coach session-credit ledger, the occurrence
// lifecycle, and coach payouts. In-memory MongoDB — nothing touches the shared
// dev/prod database.
//
// This is the money path: a credit consumed is a coach paid and a student
// charged for a session. The tests below are written around the three policy
// rules the platform agreed to, so that a future change to any of them fails
// loudly here rather than quietly in someone's bank account.
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
const offeringService = require("../client/services/CoachOfferingService");
const lifecycle = require("../client/services/CoachSessionLifecycleService");
const ledger = require("../client/services/CoachCreditLedgerService");
const controller = require("../client/controllers/coachOfferingController");
const payments = require("../client/services/CoachSubscriptionPaymentService");
const {
  CoachSubscriptionPaymentTransaction,
} = require("../client/models/CoachSubscriptionPayment");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    CoachOffering.syncIndexes(),
    CoachEnrollment.syncIndexes(),
    CoachSessionCredit.syncIndexes(),
    CoachSessionOccurrence.syncIndexes(),
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
    "coachsubscriptionpaymenttransactions",
    "coachsubscriptions",
    "coaches",
    "users",
    "coachwaitlistentries",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

// Tuesdays and Thursdays, 18:00 IST, through September 2026.
const PERIOD_START = new Date("2026-09-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-10-01T00:00:00.000Z");
/** A moment before any session in the period. */
const BEFORE_ALL = new Date("2026-08-31T00:00:00.000Z");

const seedOffering = async (
  overrides: Record<string, unknown> = {},
  packageOverrides: Record<string, unknown> = {},
) => {
  const coachId = oid();
  const pkg = await CoachSubscriptionPackage.create({
    coachId,
    name: "Monthly chess",
    frequency: "MONTHLY",
    price: 400000, // paise
    maxSessions: 8,
    maxStudents: 6,
    ...packageOverrides,
  });

  const offering = await offeringService.createOffering({
    coachId,
    sport: "Chess",
    title: "Evening chess batch",
    deliveryKind: "PROVIDER_VENUE",
    capacity: 1,
    schedule: [
      { dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 },
      { dayOfWeek: 4, startTime: "18:00", durationMinutes: 60 },
    ],
    packageId: pkg._id,
    startDate: PERIOD_START,
    ...overrides,
  });

  // Enrolment requires a published programme; createOffering leaves it DRAFT.
  if (offering.status !== "ACTIVE") {
    offering.status = "ACTIVE";
    await offering.save();
  }

  return { coachId, pkg, offering };
};

/**
 * Enrol a student the way the real flow does: hold a seat, then activate it as
 * the payment reconciliation would. Credits are minted by the activation step,
 * never by the reservation — which is exactly the property the tests below rely
 * on when they check that an unpaid hold grants nothing.
 */
const enroll = async (
  offering: any,
  overrides: Record<string, unknown> = {},
) => {
  const { now, feePaise, periodStart, periodEnd, ...seatOverrides } =
    overrides as any;

  const enrollment = await offeringService.reserveEnrollmentSeat({
    offeringId: offering._id,
    userId: oid(),
    studentName: "Test Student",
    now: now ?? BEFORE_ALL,
    ...seatOverrides,
  });

  const result = await offeringService.activateEnrollmentAfterPayment({
    enrollmentId: enrollment._id,
    subscriptionId: oid(),
    periodStart: periodStart ?? PERIOD_START,
    periodEnd: periodEnd ?? PERIOD_END,
    feePaise: feePaise ?? 400000,
    now: now ?? BEFORE_ALL,
  });

  return { enrollment: result.enrollment, creditsGranted: result.creditsGranted };
};

/** Just the hold, with no payment behind it. */
const holdSeat = async (offering: any, overrides: Record<string, unknown> = {}) =>
  offeringService.reserveEnrollmentSeat({
    offeringId: offering._id,
    userId: oid(),
    studentName: "Test Student",
    now: BEFORE_ALL,
    ...overrides,
  });

// ───────────────── enrollment and capacity ─────────────────

describe("enrollment", () => {
  it("grants one credit per session the period actually contains", async () => {
    const { offering } = await seedOffering();
    const { creditsGranted } = await enroll(offering);

    // September 2026 has 9 Tue/Thu sessions, capped by the package's 8.
    assert.equal(creditsGranted, 8);

    const credits = await CoachSessionCredit.find({});
    assert.equal(credits.length, 8);
    assert.equal(
      credits.reduce((sum: number, c: any) => sum + c.valuePaise, 0),
      400000,
      "the credits must sum to exactly the fee charged",
    );
  });

  it("pro-rates a student who joins mid-period", async () => {
    const { offering } = await seedOffering();
    const { creditsGranted } = await enroll(offering, {
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    // Only the sessions still ahead of them are bought.
    assert.ok(
      creditsGranted > 0 && creditsGranted < 8,
      `expected a partial grant, got ${creditsGranted}`,
    );
  });

  it("refuses a second student when capacity is 1", async () => {
    const { offering } = await seedOffering();
    await enroll(offering);

    await assert.rejects(() => enroll(offering), /already taken/);
  });

  it("fills a batch up to capacity and then stops", async () => {
    const { offering } = await seedOffering({ capacity: 3 });

    await enroll(offering);
    await enroll(offering);
    await enroll(offering);

    await assert.rejects(() => enroll(offering), /batch is full/);

    const live = await CoachEnrollment.countDocuments({ status: "ACTIVE" });
    assert.equal(live, 3);
  });

  it("does not overbook when students race for the last seat", async () => {
    const { offering } = await seedOffering({ capacity: 2 });

    // Five simultaneous attempts at two seats. Counting-then-inserting would
    // let several through; the atomic reservation must not.
    const results = await Promise.allSettled([
      enroll(offering),
      enroll(offering),
      enroll(offering),
      enroll(offering),
      enroll(offering),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(succeeded, 2, "capacity was exceeded under concurrency");

    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 2);
  });

  it("frees the seat again when a student leaves", async () => {
    const { offering } = await seedOffering();
    const { enrollment } = await enroll(offering);

    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });

    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 0);

    // And the seat is genuinely reusable.
    await enroll(offering);
  });

  it("requires an address when the coach travels to the student", async () => {
    const { offering } = await seedOffering({
      deliveryKind: "STUDENT_LOCATION",
    });

    await assert.rejects(() => enroll(offering), /address is required/);
  });

  it("refuses a batch that would be delivered at a student's home", async () => {
    // Eight students cannot share one living room. The model rejects it rather
    // than leaving it to be discovered on the first session.
    await assert.rejects(
      () => seedOffering({ deliveryKind: "STUDENT_LOCATION", capacity: 4 }),
      /cannot be delivered at a student's location/,
    );
  });
});

// ───────────────── the enrol endpoint prices the enrolment ─────────────────

describe("enrolling is gated on payment", () => {
  /** Minimal express-ish doubles: enough to observe status and body. */
  const mockRes = () => {
    const captured: { status?: number; body?: any } = {};
    const res: any = {
      status(code: number) {
        captured.status = code;
        return res;
      },
      json(body: any) {
        captured.body = body;
        return res;
      },
    };
    return { res, captured };
  };

  const callEnroll = async (offering: any, body: Record<string, unknown>) => {
    const { res, captured } = mockRes();
    await controller.enrollHandler(
      {
        user: { id: oid().toString(), role: "Parent" },
        params: { offeringId: offering._id.toString() },
        body,
      } as any,
      res,
    );
    return captured;
  };

  it("mints no credits — hitting the endpoint is not paying", async () => {
    // The hole this guards: enrolling used to grant a month of class credits
    // the moment the form was submitted, with no money involved at all.
    const { offering } = await seedOffering({ capacity: 2 });

    await callEnroll(offering, {
      studentName: "Cheeky Parent",
      // Attacker-controlled, and now not even read.
      feePaise: 0,
      periodStart: new Date("2020-01-01").toISOString(),
      periodEnd: new Date("2020-01-02").toISOString(),
    });

    assert.equal(
      await CoachSessionCredit.countDocuments({}),
      0,
      "the enrol endpoint granted credits without a payment",
    );
  });

  it("releases the held seat when checkout cannot be started", async () => {
    // PhonePe is unreachable in tests, which is exactly the failure this
    // asserts on: a seat held for a checkout that never began must come back.
    const { offering } = await seedOffering({ capacity: 2 });

    await callEnroll(offering, { studentName: "Abandoned Checkout" });

    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(
      reloaded.enrolledCount,
      0,
      "a failed checkout permanently consumed a seat",
    );
  });

  it("refuses to enrol into a programme that is not published", async () => {
    const { offering } = await seedOffering();
    await CoachOffering.findByIdAndUpdate(offering._id, { status: "DRAFT" });

    const captured = await callEnroll(offering, { studentName: "Early Bird" });

    assert.equal(captured.status, 404);
    assert.equal(await CoachSessionCredit.countDocuments({}), 0);
  });

  it("holds the seat while the payment is in flight", async () => {
    const { offering } = await seedOffering({ capacity: 1 });

    const held = await holdSeat(offering);

    assert.equal(held.status, "PENDING");
    assert.ok(held.holdExpiresAt, "an unpaid seat must carry an expiry");

    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 1, "the seat was not actually held");

    // And nobody else can take it meanwhile.
    await assert.rejects(() => holdSeat(offering), /already taken/);
  });

  it("returns an expired hold's seat to the batch", async () => {
    const { offering } = await seedOffering({ capacity: 1 });
    await holdSeat(offering, { holdMinutes: 10 });

    const released = await offeringService.expireUnpaidEnrollmentHolds({
      now: new Date(BEFORE_ALL.getTime() + 30 * 60 * 1000),
    });

    assert.equal(released, 1);
    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 0);
  });

  it("does not release a hold that is still within its window", async () => {
    const { offering } = await seedOffering({ capacity: 1 });
    await holdSeat(offering, { holdMinutes: 10 });

    const released = await offeringService.expireUnpaidEnrollmentHolds({
      now: new Date(BEFORE_ALL.getTime() + 60 * 1000),
    });

    assert.equal(released, 0);
  });

  it("refuses to activate an enrolment whose hold already lapsed", async () => {
    // A late webhook must not resurrect a seat that has been given away —
    // that is how a batch ends up over capacity.
    const { offering } = await seedOffering({ capacity: 1 });
    const held = await holdSeat(offering);
    await offeringService.expireUnpaidEnrollmentHolds({
      now: new Date(BEFORE_ALL.getTime() + 30 * 60 * 1000),
    });

    await assert.rejects(
      () =>
        offeringService.activateEnrollmentAfterPayment({
          enrollmentId: held._id,
          subscriptionId: oid(),
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          feePaise: 400000,
        }),
      /released before the payment completed/,
    );
  });
});

describe("payment reconciliation activates the enrolment", () => {
  const seedPaidCheckout = async (baseAmount: number) => {
    const { offering, coachId, pkg } = await seedOffering({ capacity: 2 });
    const held = await holdSeat(offering);

    const merchantOrderId = `sub_test_${Math.random().toString(36).slice(2)}`;
    await CoachSubscriptionPaymentTransaction.create({
      coachId,
      userId: held.userId,
      packageId: pkg._id,
      offeringId: offering._id,
      enrollmentId: held._id,
      merchantOrderId,
      baseAmount,
      platformFeeAmount: 5000,
      taxAmount: 900,
      amount: baseAmount + 5900,
      status: "PENDING",
      state: "PENDING",
    });

    return { offering, held, merchantOrderId };
  };

  it("grants credits only once the payment completes", async () => {
    const { held, merchantOrderId } = await seedPaidCheckout(400000);

    assert.equal(await CoachSessionCredit.countDocuments({}), 0);

    await payments.reconcileCoachSubscriptionPaymentByIdentifiers({
      merchantOrderId,
      state: "COMPLETED",
      allowActivation: true,
    });

    const credits = await CoachSessionCredit.find({});
    assert.ok(credits.length > 0, "a completed payment granted no credits");

    const reloaded = await CoachEnrollment.findById(held._id);
    assert.equal(reloaded.status, "ACTIVE");
    assert.equal(reloaded.holdExpiresAt, null, "the hold should be cleared");
  });

  it("credits the base amount only — the platform fee is not the coach's", async () => {
    const { merchantOrderId } = await seedPaidCheckout(400000);

    await payments.reconcileCoachSubscriptionPaymentByIdentifiers({
      merchantOrderId,
      state: "COMPLETED",
      allowActivation: true,
    });

    const credits = await CoachSessionCredit.find({});
    const total = credits.reduce((sum: number, c: any) => sum + c.valuePaise, 0);
    assert.equal(
      total,
      400000,
      "credits must total the base amount, not the gross charge",
    );
  });

  it("grants nothing when the payment fails", async () => {
    const { held, merchantOrderId } = await seedPaidCheckout(400000);

    await payments.reconcileCoachSubscriptionPaymentByIdentifiers({
      merchantOrderId,
      state: "FAILED",
      allowActivation: true,
    });

    assert.equal(await CoachSessionCredit.countDocuments({}), 0);
    const reloaded = await CoachEnrollment.findById(held._id);
    assert.equal(reloaded.status, "PENDING");
  });

  it("is idempotent — a replayed webhook does not double-grant", async () => {
    const { merchantOrderId } = await seedPaidCheckout(400000);

    await payments.reconcileCoachSubscriptionPaymentByIdentifiers({
      merchantOrderId,
      state: "COMPLETED",
      allowActivation: true,
    });
    const afterFirst = await CoachSessionCredit.countDocuments({});

    await payments.reconcileCoachSubscriptionPaymentByIdentifiers({
      merchantOrderId,
      state: "COMPLETED",
      allowActivation: true,
    });

    assert.equal(
      await CoachSessionCredit.countDocuments({}),
      afterFirst,
      "a replayed webhook granted a second set of credits",
    );
  });
});

// ───────────────── completing a session ─────────────────

describe("completing a session", () => {
  const seedSession = async (capacity = 1) => {
    const { offering, coachId } = await seedOffering({ capacity });
    const enrollments = [];
    for (let i = 0; i < capacity; i += 1) {
      enrollments.push((await enroll(offering)).enrollment);
    }

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: enrollments.map((e: any) => ({
        enrollmentId: e._id,
        userId: e.userId,
        studentName: e.studentName,
        attendance: "PENDING",
      })),
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });

    return { offering, coachId, enrollments, occurrence };
  };

  it("consumes one credit per seat and banks that as the coach's earning", async () => {
    const { occurrence } = await seedSession();

    const result = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });

    assert.equal(result.seatsFunded, 1);
    // Gross is the credit's value; the coach is PAID the net, after the
    // platform's 15% commission and 18% GST on it (Partner Terms).
    assert.equal(result.amountPaise, 50000); // 400000 / 8
    assert.equal(result.commissionPaise, 7500);
    assert.equal(result.commissionGstPaise, 1350);
    assert.equal(result.netPayablePaise, 41150);

    // payout.amountPaise is the NET — it is what the payout pipeline pays.
    assert.equal(result.occurrence.payout.amountPaise, 41150);
    assert.equal(result.occurrence.payout.grossPaise, 50000);
    assert.equal(
      result.occurrence.payout.amountPaise +
        result.occurrence.payout.commissionPaise +
        result.occurrence.payout.commissionGstPaise,
      result.occurrence.payout.grossPaise,
      "the payout split must reconstruct the gross exactly",
    );

    const consumed = await CoachSessionCredit.countDocuments({
      status: "CONSUMED",
    });
    assert.equal(consumed, 1);
  });

  it("earns from every student in a batch", async () => {
    const { occurrence } = await seedSession(3);

    const result = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });

    assert.equal(result.seatsFunded, 3);
    assert.equal(result.amountPaise, 150000);
  });

  it("is idempotent — completing twice does not pay twice", async () => {
    const { occurrence } = await seedSession();

    const first = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });
    const second = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });

    assert.equal(first.amountPaise, second.amountPaise);
    const consumed = await CoachSessionCredit.countDocuments({
      status: "CONSUMED",
    });
    assert.equal(consumed, 1, "a retry spent a second credit");
  });

  it("still charges and still pays when the student does not turn up", async () => {
    // Policy: makeups are owed only when the COACH cancels. A student no-show
    // consumes their credit — the coach was there.
    const { occurrence, enrollments } = await seedSession();

    await lifecycle.markAttendance({
      occurrenceId: occurrence._id,
      enrollmentId: enrollments[0]._id,
      mark: "ABSENT",
    });

    const result = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });

    assert.equal(result.amountPaise, 50000);
    assert.equal(result.occurrence.roster[0].attendance, "ABSENT");
  });

  it("records an unfunded seat rather than blocking the session", async () => {
    const { occurrence, enrollments } = await seedSession();

    // Burn every credit the student has.
    await CoachSessionCredit.updateMany(
      { enrollmentId: enrollments[0]._id },
      { $set: { status: "EXPIRED", expiredAt: new Date() } },
    );

    const result = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
    });

    assert.equal(result.seatsUnfunded, 1);
    assert.equal(result.amountPaise, 0);
    assert.equal(result.occurrence.status, "COMPLETED");
  });

  it("schedules the payout 24 hours out", async () => {
    const { occurrence } = await seedSession();
    const at = new Date("2026-09-01T13:30:00.000Z");

    const result = await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
      at,
    });

    assert.equal(
      result.occurrence.payout.releaseAt.toISOString(),
      "2026-09-02T13:30:00.000Z",
    );
  });

  it("returns the credits when a completion is reversed", async () => {
    const { occurrence } = await seedSession();
    await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });

    await lifecycle.reopenOccurrence({ occurrenceId: occurrence._id });

    const available = await CoachSessionCredit.countDocuments({
      status: "AVAILABLE",
    });
    assert.equal(available, 8, "the student silently lost a paid-for session");

    const reloaded = await CoachSessionOccurrence.findById(occurrence._id);
    assert.equal(reloaded.status, "SCHEDULED");
    assert.equal(reloaded.payout.amountPaise, 0);
  });

  it("refuses to reopen a session that has already been paid out", async () => {
    const { occurrence } = await seedSession();
    await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });
    await lifecycle.releaseDuePayouts({
      asOf: new Date("2026-09-05T00:00:00.000Z"),
    });
    await lifecycle.markPayoutPaid({ occurrenceId: occurrence._id });

    await assert.rejects(
      () => lifecycle.reopenOccurrence({ occurrenceId: occurrence._id }),
      /already been paid out/,
    );
  });
});

// ───────────────── cancellation and makeups ─────────────────

describe("coach cancellation and makeups", () => {
  const seedSession = async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });

    return { offering, enrollment, occurrence };
  };

  it("consumes nothing when the coach calls a session off", async () => {
    const { occurrence } = await seedSession();

    await lifecycle.cancelOccurrenceByCoach({
      occurrenceId: occurrence._id,
      reason: "Coach unwell",
    });

    const available = await CoachSessionCredit.countDocuments({
      status: "AVAILABLE",
    });
    assert.equal(available, 8, "a coach cancellation charged the student");
  });

  it("funds the makeup from the credit the cancellation left unspent", async () => {
    // This is the whole makeup mechanism: no entitlement is recorded anywhere,
    // the unspent credit IS the entitlement.
    const { occurrence } = await seedSession();

    await lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id });
    const makeup = await lifecycle.scheduleMakeup({
      cancelledOccurrenceId: occurrence._id,
      scheduledAt: new Date("2026-09-06T12:30:00.000Z"),
    });

    assert.equal(makeup.isMakeup, true);
    assert.equal(makeup.roster.length, 1);

    const result = await lifecycle.completeOccurrence({
      occurrenceId: makeup._id,
    });

    assert.equal(result.amountPaise, 50000);
    const available = await CoachSessionCredit.countDocuments({
      status: "AVAILABLE",
    });
    assert.equal(available, 7);
  });

  it("refuses a makeup for a session that was not cancelled by the coach", async () => {
    const { occurrence } = await seedSession();

    await assert.rejects(
      () =>
        lifecycle.scheduleMakeup({
          cancelledOccurrenceId: occurrence._id,
          scheduledAt: new Date("2026-09-06T12:30:00.000Z"),
        }),
      /only replace a session the coach or platform cancelled/,
    );
  });

  it("refuses a second makeup for the same cancellation", async () => {
    const { occurrence } = await seedSession();
    await lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id });
    await lifecycle.scheduleMakeup({
      cancelledOccurrenceId: occurrence._id,
      scheduledAt: new Date("2026-09-06T12:30:00.000Z"),
    });

    await assert.rejects(
      () =>
        lifecycle.scheduleMakeup({
          cancelledOccurrenceId: occurrence._id,
          scheduledAt: new Date("2026-09-08T12:30:00.000Z"),
        }),
      /already has a makeup/,
    );
  });

  it("lists cancellations still owing a makeup", async () => {
    const { occurrence, offering } = await seedSession();
    await lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id });

    let outstanding = await lifecycle.outstandingMakeups({
      offeringId: offering._id,
    });
    assert.equal(outstanding.length, 1);

    await lifecycle.scheduleMakeup({
      cancelledOccurrenceId: occurrence._id,
      scheduledAt: new Date("2026-09-06T12:30:00.000Z"),
    });

    outstanding = await lifecycle.outstandingMakeups({
      offeringId: offering._id,
    });
    assert.equal(outstanding.length, 0);
  });

  it("refuses to cancel a session that already completed", async () => {
    const { occurrence } = await seedSession();
    await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });

    await assert.rejects(
      () => lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id }),
      /completed session cannot be cancelled/,
    );
  });
});

// ───────────────── refunds and expiry ─────────────────

describe("refunds and expiry", () => {
  it("computes the refund basis from unused credits, not elapsed time", async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    // Deliver two sessions.
    for (const day of ["2026-09-01T12:30:00.000Z", "2026-09-03T12:30:00.000Z"]) {
      const occurrence = await CoachSessionOccurrence.create({
        offeringId: offering._id,
        coachId,
        sport: "Chess",
        scheduledAt: new Date(day),
        durationMinutes: 60,
        status: "SCHEDULED",
        roster: [
          {
            enrollmentId: enrollment._id,
            userId: enrollment.userId,
            studentName: enrollment.studentName,
            attendance: "PENDING",
          },
        ],
        isMakeup: false,
        payout: { status: "PENDING", amountPaise: 0 },
      });
      await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });
    }

    const result = await offeringService.cancelEnrollment({
      enrollmentId: enrollment._id,
    });

    // Six of eight sessions undelivered.
    assert.equal(result.unusedCredits, 6);
    assert.equal(result.refundBasisPaise, 300000);
  });

  it("marks credits refunded once the money has actually moved", async () => {
    const { offering } = await seedOffering();
    const { enrollment } = await enroll(offering);

    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });
    await ledger.markCreditsRefunded({ enrollmentId: enrollment._id });

    const refunded = await CoachSessionCredit.countDocuments({
      status: "REFUNDED",
    });
    assert.equal(refunded, 8);
  });

  it("lapses credits once their period has ended", async () => {
    const { offering } = await seedOffering();
    await enroll(offering);

    const lapsed = await ledger.expireCreditsPastPeriod({
      asOf: new Date("2026-10-02T00:00:00.000Z"),
    });

    assert.equal(lapsed, 8);
    const available = await CoachSessionCredit.countDocuments({
      status: "AVAILABLE",
    });
    assert.equal(available, 0);
  });

  it("does not lapse credits whose period is still running", async () => {
    const { offering } = await seedOffering();
    await enroll(offering);

    const lapsed = await ledger.expireCreditsPastPeriod({
      asOf: new Date("2026-09-15T00:00:00.000Z"),
    });

    assert.equal(lapsed, 0);
  });
});

// ───────────────── payouts ─────────────────

describe("coach payouts", () => {
  const completeOne = async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);
    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });
    await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
      at: new Date("2026-09-01T13:30:00.000Z"),
    });
    return { coachId, occurrence };
  };

  it("holds a payout until its release time", async () => {
    const { occurrence } = await completeOne();

    const released = await lifecycle.releaseDuePayouts({
      asOf: new Date("2026-09-01T20:00:00.000Z"),
    });

    assert.equal(released, 0);
    const reloaded = await CoachSessionOccurrence.findById(occurrence._id);
    assert.equal(reloaded.payout.status, "PENDING");
  });

  it("releases it once the window has passed", async () => {
    const { occurrence } = await completeOne();

    const released = await lifecycle.releaseDuePayouts({
      asOf: new Date("2026-09-03T00:00:00.000Z"),
    });

    assert.equal(released, 1);
    const reloaded = await CoachSessionOccurrence.findById(occurrence._id);
    assert.equal(reloaded.payout.status, "RELEASED");
  });

  it("refuses to mark an unreleased payout as paid", async () => {
    const { occurrence } = await completeOne();

    await assert.rejects(
      () => lifecycle.markPayoutPaid({ occurrenceId: occurrence._id }),
      /Only a released payout/,
    );
  });

  it("summarises what a coach is owed by payout state", async () => {
    const { coachId } = await completeOne();

    const summary = await lifecycle.coachEarningsSummary(coachId);
    assert.equal(summary.PENDING.sessions, 1);
    // What the coach is owed is the net, not the gross the session billed.
    assert.equal(summary.PENDING.amountPaise, 41150);
  });
});

describe("admin payout settlement", () => {
  const adminPayouts = require("../admin/controllers/adminPayoutController");
  const { Coach } = require("../client/models/Coach");
  const { User } = require("../client/models/User");

  const mockRes = () => {
    const captured: { status?: number; body?: any } = {};
    const res: any = {
      status(code: number) {
        captured.status = code;
        return res;
      },
      json(body: any) {
        captured.body = body;
        return res;
      },
    };
    return { res, captured };
  };

  /** A delivered session with its payout released and ready to settle. */
  const seedReleasedPayout = async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const coachUserId = oid();
    await User.collection.insertOne({
      _id: coachUserId,
      name: "Payable Coach",
      email: `payable-${coachUserId}@example.test`,
      role: "Coach",
    });
    await Coach.collection.insertOne({
      _id: coachId,
      userId: coachUserId,
      sports: ["Chess"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
      payoutMethods: [
        { type: "UPI", upiId: "coach@upi", isDefault: true, addedAt: new Date() },
      ],
    });

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });

    await lifecycle.completeOccurrence({
      occurrenceId: occurrence._id,
      at: new Date("2026-09-01T13:30:00.000Z"),
    });
    await lifecycle.releaseDuePayouts({
      asOf: new Date("2026-09-03T00:00:00.000Z"),
    });

    return { occurrence, coachUserId };
  };

  it("lists a released session payout under its own vendor role", async () => {
    // Its own role, not the `Coach` bucket: that bucket's ids are BOOKING ids,
    // and mark-paid resolves them as such. An occurrence id in there would
    // silently pay nothing.
    const { coachUserId } = await seedReleasedPayout();

    const { res, captured } = mockRes();
    await adminPayouts.listPendingPayouts({} as any, res);

    assert.equal(captured.status, 200);
    const row = (captured.body.data as any[]).find(
      (p) => p.vendorId === coachUserId.toString(),
    );
    assert.ok(row, "the coach's session payout was not listed");
    assert.equal(row.vendorRole, "CoachSession");
    // 500.00 gross - 75.00 commission - 13.50 GST = 411.50 payable.
    assert.equal(
      row.totalPendingAmount,
      411.5,
      "admin must settle the net, not the gross",
    );
    assert.equal(row.payoutMethod?.upiId, "coach@upi");
  });

  it("does not list a payout that is still inside its 24h hold", async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const coachUserId = oid();
    await Coach.collection.insertOne({
      _id: coachId,
      userId: coachUserId,
      sports: ["Chess"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
    });

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });
    // Completed, but never released.
    await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });

    const { res, captured } = mockRes();
    await adminPayouts.listPendingPayouts({} as any, res);

    const row = (captured.body.data as any[]).find(
      (p) => p.vendorId === coachUserId.toString(),
    );
    assert.equal(row, undefined, "an unreleased payout was offered for payment");
  });

  it("settles a released payout and stops listing it", async () => {
    const { occurrence, coachUserId } = await seedReleasedPayout();

    const { res, captured } = mockRes();
    await adminPayouts.markPayoutsAsPaid(
      {
        body: {
          vendorId: coachUserId.toString(),
          vendorRole: "CoachSession",
          bookingIds: [occurrence._id.toString()],
        },
      } as any,
      res,
    );

    assert.equal(captured.status, 200);
    assert.match(captured.body.message, /1 coaching session payout/);

    const settled = await CoachSessionOccurrence.findById(occurrence._id);
    assert.equal(settled.payout.status, "PAID");
    assert.ok(settled.payout.paidAt);

    // And it disappears from the pending list.
    const second = mockRes();
    await adminPayouts.listPendingPayouts({} as any, second.res);
    const row = (second.captured.body.data as any[]).find(
      (p) => p.vendorId === coachUserId.toString(),
    );
    assert.equal(row, undefined, "a settled payout was still listed");
  });

  it("cannot pay the same session twice", async () => {
    // A stale admin page could resubmit the same ids; the guarded service
    // refuses anything not in RELEASED, so the second attempt settles nothing.
    const { occurrence, coachUserId } = await seedReleasedPayout();

    const body = {
      vendorId: coachUserId.toString(),
      vendorRole: "CoachSession",
      bookingIds: [occurrence._id.toString()],
    };

    const first = mockRes();
    await adminPayouts.markPayoutsAsPaid({ body } as any, first.res);
    const second = mockRes();
    await adminPayouts.markPayoutsAsPaid({ body } as any, second.res);

    assert.match(first.captured.body.message, /1 coaching session payout/);
    assert.match(second.captured.body.message, /0 coaching session payout/);

    const settled = await CoachSessionOccurrence.findById(occurrence._id);
    assert.equal(settled.payout.status, "PAID");
  });
});

describe("renewal", () => {
  const subs = require("../client/services/CoachSubscriptionService");
  const renewal = require("../client/services/CoachRenewalService");
  const {
    CoachSubscription,
  } = require("../client/models/CoachSubscription");

  /** An enrolment funded by a real subscription, one period in. */
  const seedSubscribed = async (overrides: Record<string, unknown> = {}) => {
    const { offering, coachId, pkg } = await seedOffering(overrides);

    const userId = oid();
    const subscription = await CoachSubscription.create({
      coachId,
      userId,
      packageId: pkg._id,
      status: "ACTIVE",
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      nextBillingDate: PERIOD_END,
      autoRenew: true,
    });

    const enrollment = await offeringService.reserveEnrollmentSeat({
      offeringId: offering._id,
      userId,
      studentName: "Renewing Student",
      now: BEFORE_ALL,
    });
    await offeringService.activateEnrollmentAfterPayment({
      enrollmentId: enrollment._id,
      subscriptionId: subscription._id,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      feePaise: 400000,
      now: BEFORE_ALL,
    });

    return { offering, coachId, pkg, userId, subscription, enrollment };
  };

  // ── the period window ────────────────────────────────────────────────────

  it("advances the period start on renewal, not just the end", async () => {
    // The bug this pins: currentPeriodStart used to stay at the original
    // signup while the end advanced, so the "current period" grew by a month
    // every renewal — and credits are granted for exactly that window, so one
    // month's fee would have bought a multi-month run of classes.
    const { coachId, pkg, userId, subscription } = await seedSubscribed();

    await subs.subscribeToCoachPackage({
      userId: userId.toString(),
      coachId: coachId.toString(),
      packageId: pkg._id.toString(),
    });

    const renewed = await CoachSubscription.findById(subscription._id);
    assert.equal(
      renewed.currentPeriodStart.toISOString(),
      PERIOD_END.toISOString(),
      "the new period must start where the old one ended",
    );
    assert.ok(
      renewed.currentPeriodEnd > renewed.currentPeriodStart,
      "the period must still run forwards",
    );
  });

  it("grants one period's worth of credits on renewal, not two", async () => {
    const { offering, coachId, pkg, userId, subscription, enrollment } =
      await seedSubscribed();

    const before = await CoachSessionCredit.countDocuments({
      enrollmentId: enrollment._id,
    });

    const renewed = await subs.subscribeToCoachPackage({
      userId: userId.toString(),
      coachId: coachId.toString(),
      packageId: pkg._id.toString(),
    });
    await offeringService.activateEnrollmentAfterPayment({
      enrollmentId: enrollment._id,
      subscriptionId: renewed._id,
      periodStart: renewed.currentPeriodStart,
      periodEnd: renewed.currentPeriodEnd,
      feePaise: 400000,
      now: renewed.currentPeriodStart,
    });

    const granted =
      (await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
      })) - before;

    assert.ok(
      granted > 0 && granted <= (pkg.maxSessions ?? 8),
      `a renewal granted ${granted} credits — expected at most one period's worth`,
    );

    // And the new period's credits are worth exactly the new period's fee.
    const newPeriod = await CoachSessionCredit.find({
      enrollmentId: enrollment._id,
      periodStart: renewed.currentPeriodStart,
    });
    assert.equal(
      newPeriod.reduce((sum: number, c: any) => sum + c.valuePaise, 0),
      400000,
    );
    assert.ok(offering);
  });

  // ── grace, rather than a hard cut-off ────────────────────────────────────

  it("moves an auto-renewing subscription to PAST_DUE at period end", async () => {
    // It used to be killed outright here, which made renewal impossible.
    const { subscription } = await seedSubscribed();

    const lapsed = await subs.lapseRenewableSubscriptionsToPastDue({
      now: new Date("2026-10-02T00:00:00.000Z"),
    });

    assert.equal(lapsed, 1);
    const reloaded = await CoachSubscription.findById(subscription._id);
    assert.equal(reloaded.status, "PAST_DUE");
    assert.ok(reloaded.gracePeriodEndsAt, "grace window was not set");
  });

  it("still expires a subscription the user turned auto-renew off on", async () => {
    const { subscription } = await seedSubscribed();
    await CoachSubscription.findByIdAndUpdate(subscription._id, {
      autoRenew: false,
    });

    const lapsed = await subs.lapseRenewableSubscriptionsToPastDue({
      now: new Date("2026-10-02T00:00:00.000Z"),
    });
    assert.equal(lapsed, 0, "auto-renew off must not get a grace window");

    await subs.cleanupExpiredCoachSubscriptions({
      now: new Date("2026-10-02T00:00:00.000Z"),
    });
    const reloaded = await CoachSubscription.findById(subscription._id);
    assert.equal(reloaded.status, "EXPIRED");
  });

  it("keeps the student's seat during the grace window", async () => {
    // The point of grace: a late payment must not cost a place in a full batch.
    const { offering, subscription } = await seedSubscribed({ capacity: 1 });

    await subs.lapseRenewableSubscriptionsToPastDue({
      now: new Date("2026-10-02T00:00:00.000Z"),
    });
    await renewal.releaseEnrollmentsForExpiredSubscriptions({
      now: new Date("2026-10-02T00:00:00.000Z"),
    });

    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 1, "the seat was released too early");
    assert.equal(
      (await CoachSubscription.findById(subscription._id)).status,
      "PAST_DUE",
    );
  });

  it("releases the seat once grace has run out", async () => {
    const { offering } = await seedSubscribed({ capacity: 1 });

    const periodEnded = new Date("2026-10-02T00:00:00.000Z");
    await subs.lapseRenewableSubscriptionsToPastDue({ now: periodEnded });

    // Seven days of grace later, the subscription is genuinely finished.
    const afterGrace = new Date("2026-10-20T00:00:00.000Z");
    await subs.cleanupExpiredCoachSubscriptions({ now: afterGrace });
    const released = await renewal.releaseEnrollmentsForExpiredSubscriptions({
      now: afterGrace,
    });

    assert.equal(released, 1);
    const reloaded = await CoachOffering.findById(offering._id);
    assert.equal(reloaded.enrolledCount, 0, "the seat never came back");
  });

  it("takes a released student off future sessions but not past ones", async () => {
    const { offering, coachId, enrollment } = await seedSubscribed();

    const past = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-01T12:30:00.000Z"),
      durationMinutes: 60,
      status: "COMPLETED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PRESENT",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });
    const future = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-11-03T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });

    await CoachSubscription.updateMany({}, { $set: { status: "EXPIRED" } });
    await renewal.releaseEnrollmentsForExpiredSubscriptions({
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    const pastAfter = await CoachSessionOccurrence.findById(past._id);
    const futureAfter = await CoachSessionOccurrence.findById(future._id);
    assert.equal(
      pastAfter.roster.length,
      1,
      "a delivered session's attendance record was rewritten",
    );
    assert.equal(futureAfter.roster.length, 0);
  });

  // ── reminders ────────────────────────────────────────────────────────────

  it("nudges the payer before the period ends", async () => {
    await seedSubscribed();

    const sent = await renewal.sendRenewalReminders({
      now: new Date("2026-09-29T00:00:00.000Z"),
    });

    assert.equal(sent, 1);
  });

  it("nudges only once per period", async () => {
    await seedSubscribed();
    const now = new Date("2026-09-29T00:00:00.000Z");

    await renewal.sendRenewalReminders({ now });
    assert.equal(await renewal.sendRenewalReminders({ now }), 0);
  });

  it("does not nudge a period that is still weeks away", async () => {
    await seedSubscribed();

    const sent = await renewal.sendRenewalReminders({
      now: new Date("2026-09-05T00:00:00.000Z"),
    });

    assert.equal(sent, 0);
  });

  it("can nudge again after a renewal", async () => {
    const { coachId, pkg, userId } = await seedSubscribed();

    await renewal.sendRenewalReminders({
      now: new Date("2026-09-29T00:00:00.000Z"),
    });
    await subs.subscribeToCoachPackage({
      userId: userId.toString(),
      coachId: coachId.toString(),
      packageId: pkg._id.toString(),
    });

    // The next period comes due; the payer must hear about it too.
    const sent = await renewal.sendRenewalReminders({
      now: new Date("2026-10-30T00:00:00.000Z"),
    });
    assert.equal(sent, 1, "a renewed subscription never nudges again");
  });

  // ── what can still be renewed ────────────────────────────────────────────

  it("offers a renewal target for a live enrolment", async () => {
    const { enrollment, userId, offering } = await seedSubscribed();

    const target = await renewal.renewalTargetForEnrollment({
      enrollmentId: enrollment._id,
      userId,
    });

    assert.ok(target);
    assert.equal(target.offeringId.toString(), offering._id.toString());
  });

  it("refuses to renew someone else's enrolment", async () => {
    const { enrollment } = await seedSubscribed();

    const target = await renewal.renewalTargetForEnrollment({
      enrollmentId: enrollment._id,
      userId: oid(),
    });

    assert.equal(target, null);
  });

  it("refuses to renew an enrolment whose seat is already gone", async () => {
    const { enrollment, userId } = await seedSubscribed();
    await CoachSubscription.updateMany({}, { $set: { status: "EXPIRED" } });
    await renewal.releaseEnrollmentsForExpiredSubscriptions({
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    const target = await renewal.renewalTargetForEnrollment({
      enrollmentId: enrollment._id,
      userId,
    });

    assert.equal(
      target,
      null,
      "renewing a released enrolment would skip the capacity check",
    );
  });
});

describe("refunding unused classes", () => {
  const refunds = require("../client/services/CoachEnrollmentRefundService");
  const refundService = require("../client/services/RefundService");

  /** An enrolment with a settled payment behind it, ready to be left. */
  const seedPaidEnrollment = async (baseAmount = 400000) => {
    const { offering, coachId, pkg } = await seedOffering();
    const { enrollment } = await enroll(offering);

    await CoachSubscriptionPaymentTransaction.create({
      coachId,
      userId: enrollment.userId,
      packageId: pkg._id,
      offeringId: offering._id,
      enrollmentId: enrollment._id,
      merchantOrderId: `sub_refund_${Math.random().toString(36).slice(2)}`,
      baseAmount,
      platformFeeAmount: 5000,
      taxAmount: 900,
      amount: baseAmount + 5900,
      status: "COMPLETED",
      state: "COMPLETED",
    });

    return { offering, coachId, enrollment };
  };

  /** Stand in for the gateway so these tests assert OUR logic, not PhonePe's. */
  const stubGateway = (impl: (payload: any) => Promise<any>) => {
    const original = refundService.initiateRefund;
    refundService.initiateRefund = impl;
    return () => {
      refundService.initiateRefund = original;
    };
  };

  it("refunds exactly the value of the classes not taken", async () => {
    const { coachId, enrollment, offering } = await seedPaidEnrollment();

    // Deliver two of the eight classes.
    for (const day of ["2026-09-01T12:30:00.000Z", "2026-09-03T12:30:00.000Z"]) {
      const occurrence = await CoachSessionOccurrence.create({
        offeringId: offering._id,
        coachId,
        sport: "Chess",
        scheduledAt: new Date(day),
        durationMinutes: 60,
        status: "SCHEDULED",
        roster: [
          {
            enrollmentId: enrollment._id,
            userId: enrollment.userId,
            studentName: enrollment.studentName,
            attendance: "PENDING",
          },
        ],
        isMakeup: false,
        payout: { status: "PENDING", amountPaise: 0 },
      });
      await lifecycle.completeOccurrence({ occurrenceId: occurrence._id });
    }

    let asked = 0;
    const restore = stubGateway(async (payload: any) => {
      asked = payload.amount;
      return { transactionId: "t", state: "INITIATED", amount: payload.amount, method: "ORIGINAL_CARD" };
    });

    const result = await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    // Six of eight classes unused, at 50000 paise each.
    assert.equal(result.status, "REFUNDED");
    assert.equal(result.amountPaise, 300000);
    assert.equal(asked, 300000, "the gateway was asked for the wrong amount");
  });

  it("refunds the coach's share, not the platform fee", async () => {
    // Policy: the fee and its tax stay with the platform. If that changes, this
    // test is the thing that should fail first.
    const { enrollment } = await seedPaidEnrollment();

    let asked = 0;
    const restore = stubGateway(async (payload: any) => {
      asked = payload.amount;
      return { transactionId: "t", state: "INITIATED", amount: payload.amount, method: "ORIGINAL_CARD" };
    });
    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    assert.equal(asked, 400000, "the platform fee was refunded too");
  });

  it("marks the credits refunded once the money has moved", async () => {
    const { enrollment } = await seedPaidEnrollment();

    const restore = stubGateway(async (payload: any) => ({
      transactionId: "t",
      state: "INITIATED",
      amount: payload.amount,
      method: "ORIGINAL_CARD",
    }));
    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    assert.equal(
      await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
        status: "REFUNDED",
      }),
      8,
    );
  });

  it("cannot refund the same enrolment twice", async () => {
    const { enrollment } = await seedPaidEnrollment();

    let calls = 0;
    const restore = stubGateway(async (payload: any) => {
      calls += 1;
      return { transactionId: "t", state: "INITIATED", amount: payload.amount, method: "ORIGINAL_CARD" };
    });

    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    const second = await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    assert.equal(calls, 1, "a second call paid out again");
    assert.equal(second.status, "NOTHING_OWED");
  });

  it("leaves the claim frozen and retryable when the gateway fails", async () => {
    // The hole this guards: credits left AVAILABLE would be swallowed by the
    // period-end expiry sweep, and the student's money would vanish.
    const { enrollment } = await seedPaidEnrollment();

    const restore = stubGateway(async () => {
      throw new Error("gateway down");
    });
    const result = await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    assert.equal(result.status, "FAILED");
    assert.equal(
      await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
        status: "REFUND_PENDING",
      }),
      8,
    );
  });

  it("does not let period-end expiry swallow a pending refund", async () => {
    const { enrollment } = await seedPaidEnrollment();

    const restore = stubGateway(async () => {
      throw new Error("gateway down");
    });
    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    const lapsed = await ledger.expireCreditsPastPeriod({
      asOf: new Date("2026-11-01T00:00:00.000Z"),
    });

    assert.equal(lapsed, 0, "expiry destroyed a refund the student was owed");
    assert.equal(
      await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
        status: "REFUND_PENDING",
      }),
      8,
    );
  });

  it("retries a failed refund and settles it", async () => {
    const { enrollment } = await seedPaidEnrollment();

    let restore = stubGateway(async () => {
      throw new Error("gateway down");
    });
    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    restore = stubGateway(async (payload: any) => ({
      transactionId: "t",
      state: "INITIATED",
      amount: payload.amount,
      method: "ORIGINAL_CARD",
    }));
    const retried = await refunds.retryPendingEnrollmentRefunds();
    restore();

    assert.equal(retried.attempted, 1);
    assert.equal(retried.refunded, 1);
    assert.equal(
      await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
        status: "REFUNDED",
      }),
      8,
    );
  });

  it("hands the credits back when there is no payment to refund against", async () => {
    // A comped or hand-created enrolment. Freezing forever would hide a claim
    // nothing is chasing.
    const { offering } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const result = await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });

    assert.equal(result.status, "NO_PAYMENT_FOUND");
    assert.equal(
      await CoachSessionCredit.countDocuments({
        enrollmentId: enrollment._id,
        status: "AVAILABLE",
      }),
      8,
    );
  });

  it("never asks for more than the payment can give back", async () => {
    const { enrollment } = await seedPaidEnrollment();
    // Most of the payment has already been refunded by hand.
    await CoachSubscriptionPaymentTransaction.updateMany(
      { enrollmentId: enrollment._id },
      { $set: { refundAmount: 380000 } },
    );

    let asked = 0;
    const restore = stubGateway(async (payload: any) => {
      asked = payload.amount;
      return { transactionId: "t", state: "INITIATED", amount: payload.amount, method: "ORIGINAL_CARD" };
    });
    await refunds.refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id,
    });
    restore();

    // 405900 charged - 380000 already returned = 25900 of headroom.
    assert.equal(asked, 25900, "over-claimed against the original payment");
  });

  it("previews what a student would get back before they leave", async () => {
    const { enrollment } = await seedPaidEnrollment();

    const preview = await refunds.previewEnrollmentRefund(enrollment._id);

    assert.equal(preview.creditCount, 8);
    assert.equal(preview.amountPaise, 400000);
  });
});

describe("policy: makeups run inside the period that paid for them", () => {
  const seedCancelled = async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-15T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [
        {
          enrollmentId: enrollment._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
          attendance: "PENDING",
        },
      ],
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });
    await lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id });

    return { occurrence };
  };

  it("allows a makeup before the period ends", async () => {
    const { occurrence } = await seedCancelled();

    const makeup = await lifecycle.scheduleMakeup({
      cancelledOccurrenceId: occurrence._id,
      scheduledAt: new Date("2026-09-22T12:30:00.000Z"),
    });

    assert.equal(makeup.isMakeup, true);
  });

  it("refuses a makeup after the credits would have expired", async () => {
    // Beyond the period end, the credit funding the seat is gone — the coach
    // would deliver a class nobody can pay them for.
    const { occurrence } = await seedCancelled();

    await assert.rejects(
      () =>
        lifecycle.scheduleMakeup({
          cancelledOccurrenceId: occurrence._id,
          scheduledAt: new Date("2026-10-15T12:30:00.000Z"),
        }),
      /must run by/,
    );
  });

  it("uses the earliest deadline on the roster, not the latest", async () => {
    // In a batch with staggered joins, the later date strands whoever renews
    // soonest, so the binding date is the earliest.
    const { offering, coachId } = await seedOffering({ capacity: 2 });
    const first = await enroll(offering);
    const second = await enroll(offering, {
      periodEnd: new Date("2026-09-20T00:00:00.000Z"),
    });

    const occurrence = await CoachSessionOccurrence.create({
      offeringId: offering._id,
      coachId,
      sport: "Chess",
      scheduledAt: new Date("2026-09-08T12:30:00.000Z"),
      durationMinutes: 60,
      status: "SCHEDULED",
      roster: [first, second].map((r: any) => ({
        enrollmentId: r.enrollment._id,
        userId: r.enrollment.userId,
        studentName: r.enrollment.studentName,
        attendance: "PENDING",
      })),
      isMakeup: false,
      payout: { status: "PENDING", amountPaise: 0 },
    });
    await lifecycle.cancelOccurrenceByCoach({ occurrenceId: occurrence._id });

    // After the EARLIER of the two period ends.
    await assert.rejects(
      () =>
        lifecycle.scheduleMakeup({
          cancelledOccurrenceId: occurrence._id,
          scheduledAt: new Date("2026-09-25T12:30:00.000Z"),
        }),
      /must run by/,
    );
  });
});

describe("policy: cancellations are counted, not capped", () => {
  it("lets a coach keep cancelling but surfaces the count", async () => {
    const { offering, coachId } = await seedOffering();
    const { enrollment } = await enroll(offering);

    const makeOccurrence = async (day: string) =>
      CoachSessionOccurrence.create({
        offeringId: offering._id,
        coachId,
        sport: "Chess",
        scheduledAt: new Date(day),
        durationMinutes: 60,
        status: "SCHEDULED",
        roster: [
          {
            enrollmentId: enrollment._id,
            userId: enrollment.userId,
            studentName: enrollment.studentName,
            attendance: "PENDING",
          },
        ],
        isMakeup: false,
        payout: { status: "PENDING", amountPaise: 0 },
      });

    const cancelled = [];
    for (const day of [
      "2026-09-01T12:30:00.000Z",
      "2026-09-03T12:30:00.000Z",
      "2026-09-08T12:30:00.000Z",
      "2026-09-10T12:30:00.000Z",
    ]) {
      const o = await makeOccurrence(day);
      await lifecycle.cancelOccurrenceByCoach({ occurrenceId: o._id });
      cancelled.push(o);
    }

    // Delivered one.
    const delivered = await makeOccurrence("2026-09-15T12:30:00.000Z");
    await lifecycle.completeOccurrence({ occurrenceId: delivered._id });

    const stats = await lifecycle.coachReliabilitySummary({
      coachId,
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    assert.equal(stats.cancelledByCoach, 4);
    assert.equal(stats.delivered, 1);
    assert.equal(stats.cancellationRate, 80);
    assert.equal(stats.makeupsOwed, 4);
  });

  it("reports a clean record as zero, not as a divide-by-zero", async () => {
    const { coachId } = await seedOffering();

    const stats = await lifecycle.coachReliabilitySummary({ coachId });

    assert.equal(stats.cancellationRate, 0);
    assert.equal(stats.delivered, 0);
  });
});

describe("policy: waitlist with notify-on-seat-free", () => {
  const waitlist = require("../client/services/CoachWaitlistService");
  const {
    CoachWaitlistEntry,
  } = require("../client/models/CoachWaitlistEntry");

  const fullOffering = async () => {
    const { offering } = await seedOffering({ capacity: 1 });
    const { enrollment } = await enroll(offering);
    return { offering, enrollment };
  };

  it("refuses a waitlist join when a seat is actually free", async () => {
    // Queueing for a seat you could just take is a dead end.
    const { offering } = await seedOffering({ capacity: 2 });

    await assert.rejects(
      () =>
        waitlist.joinWaitlist({
          offeringId: offering._id,
          userId: oid(),
          studentName: "Too Early",
        }),
      /place available/,
    );
  });

  it("accepts a join when the batch is full", async () => {
    const { offering } = await fullOffering();

    const entry = await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Patient Parent",
    });

    assert.equal(entry.status, "WAITING");
  });

  it("refuses to queue someone already enrolled", async () => {
    const { offering, enrollment } = await fullOffering();

    await assert.rejects(
      () =>
        waitlist.joinWaitlist({
          offeringId: offering._id,
          userId: enrollment.userId,
          studentName: enrollment.studentName,
        }),
      /already enrolled/,
    );
  });

  it("refuses the same person twice", async () => {
    const { offering } = await fullOffering();
    const userId = oid();

    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId,
      studentName: "Twice",
    });

    await assert.rejects(() =>
      waitlist.joinWaitlist({
        offeringId: offering._id,
        userId,
        studentName: "Twice",
      }),
    );
  });

  it("tells the whole queue when a student leaves", async () => {
    const { offering, enrollment } = await fullOffering();
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "First",
    });
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Second",
    });

    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });

    const notified = await CoachWaitlistEntry.countDocuments({
      offeringId: offering._id,
      status: "NOTIFIED",
    });
    assert.equal(notified, 2, "the queue was not told about the free seat");
  });

  it("says nothing when the programme is still full", async () => {
    const { offering } = await fullOffering();
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Waiting",
    });

    const notified = await waitlist.notifyWaitlistOfFreeSeat({
      offeringId: offering._id,
    });

    assert.equal(notified, 0, "notified about a seat that does not exist");
  });

  it("does not re-notify the same person within the cooldown", async () => {
    // Seats free and refill constantly — an expiring hold alone frees one every
    // ten minutes. Without the cooldown this would be spam.
    const { offering, enrollment } = await fullOffering();
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Waiting",
    });
    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });

    const again = await waitlist.notifyWaitlistOfFreeSeat({
      offeringId: offering._id,
    });

    assert.equal(again, 0);
  });

  it("notifies again once the cooldown has passed", async () => {
    const { offering, enrollment } = await fullOffering();
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Waiting",
    });
    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });

    const later = new Date(Date.now() + 13 * 60 * 60 * 1000);
    const again = await waitlist.notifyWaitlistOfFreeSeat({
      offeringId: offering._id,
      now: later,
    });

    assert.equal(again, 1);
  });

  it("stops chasing someone once they get in", async () => {
    const { offering, enrollment } = await fullOffering();
    const userId = oid();
    await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId,
      studentName: "Got In",
    });

    await offeringService.cancelEnrollment({ enrollmentId: enrollment._id });
    await waitlist.convertWaitlistEntry({
      offeringId: offering._id,
      userId,
    });

    const entry = await CoachWaitlistEntry.findOne({ userId });
    assert.equal(entry.status, "CONVERTED");

    // And they are no longer in the queue for future seats.
    const live = await waitlist.waitlistForOffering(offering._id);
    assert.equal(live.length, 0);
  });

  it("lets someone step off the list", async () => {
    const { offering } = await fullOffering();
    const userId = oid();
    const entry = await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId,
      studentName: "Changed Mind",
    });

    assert.equal(
      await waitlist.leaveWaitlist({ entryId: entry._id, userId }),
      true,
    );
    assert.equal((await waitlist.waitlistForOffering(offering._id)).length, 0);
  });

  it("will not let one person remove another from the list", async () => {
    const { offering } = await fullOffering();
    const entry = await waitlist.joinWaitlist({
      offeringId: offering._id,
      userId: oid(),
      studentName: "Someone Else",
    });

    assert.equal(
      await waitlist.leaveWaitlist({ entryId: entry._id, userId: oid() }),
      false,
    );
    assert.equal((await waitlist.waitlistForOffering(offering._id)).length, 1);
  });
});
