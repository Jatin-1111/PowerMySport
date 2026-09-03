import mongoose from "mongoose";
import { CoachOffering, CoachOfferingDocument, CoachOfferingSlot } from "../models/CoachOffering";
import { CoachEnrollment, CoachEnrollmentDocument } from "../models/CoachEnrollment";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { CoachSessionOccurrence } from "../models/CoachSessionOccurrence";
import {
  generateOccurrences,
  scheduledInstantsBetween,
  syncRostersForFutureOccurrences,
} from "./CoachOccurrenceService";
import { grantCreditsForPeriod, refundBasisPaiseForEnrollment } from "./CoachCreditLedgerService";
import { notifyWaitlistOfFreeSeat } from "./CoachWaitlistService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachOfferings");

/**
 * Offerings and enrollments — what a coach sells, and who is on the roster.
 *
 * Capacity 1 and capacity N run through exactly the same code here. If a branch
 * on `capacity === 1` ever appears in this file, the model is being worked
 * around rather than used.
 */

export interface CreateOfferingPayload {
  coachId: mongoose.Types.ObjectId;
  sport: string;
  title: string;
  description?: string;
  deliveryKind: CoachOfferingDocument["deliveryKind"];
  venueId?: mongoose.Types.ObjectId;
  onlinePlatform?: string;
  defaultMeetingLink?: string;
  capacity?: number;
  schedule: CoachOfferingSlot[];
  timezone?: string;
  packageId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date | null;
}

export const createOffering = async (
  payload: CreateOfferingPayload
): Promise<CoachOfferingDocument> => {
  const pkg = await CoachSubscriptionPackage.findById(payload.packageId);
  if (!pkg) throw new Error("Billing package not found");
  if (pkg.coachId.toString() !== payload.coachId.toString()) {
    throw new Error("That billing package belongs to a different coach");
  }

  // A batch cannot sell more seats than its package allows students.
  const capacity = payload.capacity ?? 1;
  if (pkg.maxStudents != null && capacity > pkg.maxStudents) {
    throw new Error(
      `Capacity ${capacity} exceeds the package's limit of ${pkg.maxStudents} students`
    );
  }

  return CoachOffering.create({
    ...payload,
    capacity,
    timezone: payload.timezone || "Asia/Kolkata",
    status: "DRAFT",
  });
};

/**
 * Publish an offering and materialise its first window of sessions.
 */
export const activateOffering = async (params: {
  offeringId: mongoose.Types.ObjectId;
  now?: Date;
}): Promise<{ offering: CoachOfferingDocument; created: number }> => {
  const offering = await CoachOffering.findById(params.offeringId);
  if (!offering) throw new Error("Offering not found");

  if (offering.status === "ARCHIVED") {
    throw new Error("An archived offering cannot be reactivated");
  }

  offering.status = "ACTIVE";
  await offering.save();

  const result = await generateOccurrences({
    offering,
    ...(params.now ? { now: params.now } : {}),
  });
  return { offering, created: result.created };
};

/**
 * Pause an offering: stop generating, and drop sessions nobody has attended yet.
 *
 * Deliberately leaves completed and cancelled sessions alone — they carry
 * attendance, credits and payouts, and are history.
 */
export const pauseOffering = async (params: {
  offeringId: mongoose.Types.ObjectId;
  now?: Date;
}): Promise<{ offering: CoachOfferingDocument; removed: number }> => {
  const now = params.now ?? new Date();
  const offering = await CoachOffering.findById(params.offeringId);
  if (!offering) throw new Error("Offering not found");

  offering.status = "PAUSED";
  offering.generatedThrough = null;
  await offering.save();

  const result = await CoachSessionOccurrence.deleteMany({
    offeringId: offering._id,
    status: "SCHEDULED",
    scheduledAt: { $gt: now },
    isMakeup: false,
  });

  return { offering, removed: result.deletedCount ?? 0 };
};

// ───────────────── enrollment ─────────────────

export interface ReserveSeatPayload {
  offeringId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  studentName: string;
  deliveryAddress?: {
    addressSnapshot?: string;
    coordinates?: [number, number];
  } | null;
  /** How long the unpaid seat is held for. */
  holdMinutes?: number;
  now?: Date;
}

/** Default checkout window, matching the booking flow's 10-minute hold. */
export const ENROLLMENT_HOLD_MINUTES = 10;

/**
 * Hold a seat for a student who is about to pay.
 *
 * This does NOT make them a student and does NOT grant credits — payment does,
 * via `activateEnrollmentAfterPayment`. What it does is stop a parent from
 * completing a payment only to discover the last seat went to someone else
 * while they were on the gateway.
 *
 * The seat is RESERVED before the enrolment row is written — see the comment on
 * `CoachOffering.enrolledCount`. If the write fails the reservation is handed
 * back, so a crash cannot permanently shrink a batch.
 */
export const reserveEnrollmentSeat = async (
  payload: ReserveSeatPayload
): Promise<CoachEnrollmentDocument> => {
  const now = payload.now ?? new Date();

  const offering = await CoachOffering.findById(payload.offeringId);
  if (!offering) throw new Error("Offering not found");
  if (offering.status !== "ACTIVE") {
    throw new Error("This programme is not open for enrolment");
  }

  if (
    offering.deliveryKind === "STUDENT_LOCATION" &&
    !payload.deliveryAddress?.coordinates &&
    !payload.deliveryAddress?.addressSnapshot
  ) {
    throw new Error("This coach travels to the student, so an address is required to enroll");
  }

  // Atomically claim a seat. Returns null when the batch is already full.
  const reserved = await CoachOffering.findOneAndUpdate(
    {
      _id: payload.offeringId,
      $expr: { $lt: ["$enrolledCount", "$capacity"] },
    },
    { $inc: { enrolledCount: 1 } },
    { new: true }
  ).exec();

  if (!reserved) {
    throw new Error(
      offering.capacity === 1
        ? "This coach is already taken for this programme"
        : `This batch is full (${offering.capacity} students)`
    );
  }

  try {
    return await CoachEnrollment.create({
      offeringId: payload.offeringId,
      coachId: offering.coachId,
      userId: payload.userId,
      playerId: payload.playerId ?? null,
      studentName: payload.studentName,
      status: "PENDING",
      joinedAt: now,
      holdExpiresAt: new Date(
        now.getTime() + (payload.holdMinutes ?? ENROLLMENT_HOLD_MINUTES) * 60 * 1000
      ),
      deliveryAddress: payload.deliveryAddress ?? null,
    });
  } catch (error) {
    // Hand the seat back — otherwise a duplicate-enrolment attempt would
    // permanently consume capacity nobody is using.
    await CoachOffering.findByIdAndUpdate(payload.offeringId, {
      $inc: { enrolledCount: -1 },
    });
    throw error;
  }
};

/**
 * Turn a paid-for pending enrolment into a live one.
 *
 * Called from the payment reconciliation path once a subscription is actually
 * activated — never from the enrol endpoint, because until money has moved the
 * student has a held seat and nothing else. This is the only place that grants
 * a first period's credits.
 *
 * Idempotent in both directions: a replayed webhook finds the enrolment already
 * ACTIVE and renews rather than re-granting, and the ledger itself refuses to
 * double-grant the same period.
 */
export const activateEnrollmentAfterPayment = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  feePaise: number;
  now?: Date;
}): Promise<{ enrollment: CoachEnrollmentDocument; creditsGranted: number }> => {
  const now = params.now ?? new Date();

  const enrollment = await CoachEnrollment.findById(params.enrollmentId);
  if (!enrollment) throw new Error("Enrollment not found");

  if (enrollment.status === "CANCELLED") {
    // The hold expired and the seat was released before the payment landed.
    // Refusing here is deliberate: silently resurrecting the enrolment could
    // push the batch over capacity.
    throw new Error(
      "This enrolment was released before the payment completed. " +
        "The seat may have been taken — refund or re-enrol manually."
    );
  }

  const offering = await CoachOffering.findById(enrollment.offeringId);
  if (!offering) throw new Error("Offering not found");

  const pkg = await CoachSubscriptionPackage.findById(offering.packageId);
  const scheduled = scheduledInstantsBetween(
    offering,
    now > params.periodStart ? now : params.periodStart,
    params.periodEnd
  ).length;
  const cap = pkg?.maxSessions ?? null;
  const sessionCount = cap == null ? scheduled : Math.min(scheduled, cap);

  enrollment.status = "ACTIVE";
  enrollment.subscriptionId = params.subscriptionId;
  // The seat is paid for; it is no longer a hold.
  enrollment.holdExpiresAt = null;
  await enrollment.save();

  const credits = await grantCreditsForPeriod({
    enrollmentId: enrollment._id as mongoose.Types.ObjectId,
    offeringId: offering._id as mongoose.Types.ObjectId,
    coachId: offering.coachId,
    userId: enrollment.userId,
    playerId: enrollment.playerId ?? null,
    subscriptionId: params.subscriptionId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    sessionCount,
    feePaise: params.feePaise,
  });

  await syncRostersForFutureOccurrences({
    offeringId: offering._id as mongoose.Types.ObjectId,
    now,
  });

  log.info(
    `activateEnrollmentAfterPayment: enrolment ${enrollment._id.toString()} live ` +
      `with ${credits.length} credit(s)`
  );

  return { enrollment, creditsGranted: credits.length };
};

/**
 * Release seats held by checkouts that were never paid.
 *
 * Without this an abandoned payment holds a seat forever, and a batch silently
 * shrinks every time someone opens the checkout and closes the tab.
 */
export const expireUnpaidEnrollmentHolds = async (
  params: {
    now?: Date;
  } = {}
): Promise<number> => {
  const now = params.now ?? new Date();

  const stale = await CoachEnrollment.find({
    status: "PENDING",
    holdExpiresAt: { $ne: null, $lt: now },
  }).select("_id offeringId");

  let released = 0;
  for (const enrollment of stale) {
    // Conditional so a payment landing at this exact moment wins the race and
    // the seat is not pulled out from under a student who has just paid.
    const claimed = await CoachEnrollment.findOneAndUpdate(
      { _id: enrollment._id, status: "PENDING" },
      {
        $set: {
          status: "CANCELLED",
          leftAt: now,
          cancellationReason: "Payment not completed",
        },
      }
    );
    if (!claimed) continue;

    await CoachOffering.findByIdAndUpdate(enrollment.offeringId, {
      $inc: { enrolledCount: -1 },
    });
    released += 1;
  }

  if (released > 0) {
    log.info(`expireUnpaidEnrollmentHolds: released ${released} held seat(s)`);
    for (const offeringId of new Set(stale.map((e) => e.offeringId.toString()))) {
      await notifyWaitlistOfFreeSeat({
        offeringId: new mongoose.Types.ObjectId(offeringId),
        now,
      });
    }
  }
  return released;
};

/**
 * Take a student off the roster.
 *
 * Returns the refund basis — the value of the sessions they paid for and did
 * not receive — computed from the ledger rather than estimated from elapsed
 * time. Money is NOT moved here; `refundUnusedCreditsForEnrollment` does that,
 * and the leave endpoint calls it immediately afterwards. Keeping the two apart
 * means cancelling still succeeds when the payment gateway is down.
 */
export const cancelEnrollment = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  reason?: string;
  now?: Date;
}): Promise<{
  enrollment: CoachEnrollmentDocument;
  refundBasisPaise: number;
  unusedCredits: number;
}> => {
  const now = params.now ?? new Date();

  const enrollment = await CoachEnrollment.findById(params.enrollmentId);
  if (!enrollment) throw new Error("Enrollment not found");

  if (enrollment.status === "CANCELLED") {
    const basis = await refundBasisPaiseForEnrollment(enrollment._id as mongoose.Types.ObjectId);
    return {
      enrollment,
      refundBasisPaise: basis.amountPaise,
      unusedCredits: basis.creditCount,
    };
  }

  const basis = await refundBasisPaiseForEnrollment(enrollment._id as mongoose.Types.ObjectId);

  enrollment.status = "CANCELLED";
  enrollment.leftAt = now;
  if (params.reason) enrollment.cancellationReason = params.reason;
  await enrollment.save();

  // Free the seat for someone else.
  await CoachOffering.findByIdAndUpdate(enrollment.offeringId, {
    $inc: { enrolledCount: -1 },
  });

  await syncRostersForFutureOccurrences({
    offeringId: enrollment.offeringId,
    now,
  });

  // A seat just came back — tell whoever is waiting for one.
  await notifyWaitlistOfFreeSeat({ offeringId: enrollment.offeringId, now });

  return {
    enrollment,
    refundBasisPaise: basis.amountPaise,
    unusedCredits: basis.creditCount,
  };
};

/**
 * Grant the next period's credits when a subscription renews.
 *
 * Idempotent per (enrollment, period) inside the ledger, so a retried billing
 * webhook cannot double-grant.
 */
export const renewEnrollmentPeriod = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  feePaise: number;
}): Promise<number> => {
  const enrollment = await CoachEnrollment.findById(params.enrollmentId);
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.status !== "ACTIVE") {
    throw new Error("Only an active enrollment can be renewed");
  }

  const offering = await CoachOffering.findById(enrollment.offeringId);
  if (!offering) throw new Error("Offering not found");

  const pkg = await CoachSubscriptionPackage.findById(offering.packageId);
  const scheduled = scheduledInstantsBetween(offering, params.periodStart, params.periodEnd).length;
  const cap = pkg?.maxSessions ?? null;
  const sessionCount = cap == null ? scheduled : Math.min(scheduled, cap);

  const credits = await grantCreditsForPeriod({
    enrollmentId: enrollment._id as mongoose.Types.ObjectId,
    offeringId: offering._id as mongoose.Types.ObjectId,
    coachId: offering.coachId,
    userId: enrollment.userId,
    playerId: enrollment.playerId ?? null,
    subscriptionId: enrollment.subscriptionId ?? null,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    sessionCount,
    feePaise: params.feePaise,
  });

  return credits.length;
};

/** The live roster of an offering. */
export const rosterForOffering = async (
  offeringId: mongoose.Types.ObjectId
): Promise<CoachEnrollmentDocument[]> =>
  CoachEnrollment.find({
    offeringId,
    status: { $in: ["ACTIVE", "PENDING", "PAUSED"] },
  })
    .sort({ joinedAt: 1 })
    .lean()
    .exec() as unknown as Promise<CoachEnrollmentDocument[]>;

/**
 * Repair `enrolledCount` from the enrollments that actually exist.
 *
 * A reservation counter can drift if a process dies between the increment and
 * the write it was reserving for. This is the reconciliation, safe to run any
 * time, and is what the migration uses to seed the field.
 */
export const reconcileEnrolledCount = async (
  offeringId: mongoose.Types.ObjectId
): Promise<number> => {
  const live = await CoachEnrollment.countDocuments({
    offeringId,
    status: { $in: ["ACTIVE", "PENDING", "PAUSED"] },
  });

  await CoachOffering.findByIdAndUpdate(offeringId, { enrolledCount: live });
  return live;
};
