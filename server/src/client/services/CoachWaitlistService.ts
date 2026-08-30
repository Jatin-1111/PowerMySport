import mongoose from "mongoose";
import { CoachOffering } from "../models/CoachOffering";
import { CoachEnrollment } from "../models/CoachEnrollment";
import {
  CoachWaitlistEntry,
  CoachWaitlistEntryDocument,
} from "../models/CoachWaitlistEntry";
import { NotificationType } from "../models/Notification";
import { NotificationService } from "./NotificationService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachWaitlist");

/**
 * The waiting list for a full programme.
 *
 * See the block comment on `CoachWaitlistEntry` for why this is its own entity
 * and why a freed seat is offered to everyone waiting rather than held for the
 * person at the front.
 */

/**
 * How long before the same person is told about a freed seat again.
 *
 * Seats can free and refill repeatedly — an abandoned checkout alone releases
 * one every ten minutes. Without a cooldown a popular programme would notify
 * the same parents several times an hour.
 */
export const WAITLIST_NOTIFY_COOLDOWN_HOURS = 12;

const notify = (
  userId: mongoose.Types.ObjectId | string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  email = false,
) => {
  NotificationService.send(
    { userId: userId.toString(), type, title, message, data },
    { sendEmail: email },
  ).catch((err: unknown) =>
    log.error("[coachWaitlist] notification failed:", err),
  );
};

/**
 * Join the waiting list for a programme.
 *
 * Refuses when there is actually room — being on a waitlist for a seat you
 * could simply take is a confusing dead end, so the caller is told to enrol.
 */
export const joinWaitlist = async (params: {
  offeringId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  studentName: string;
  now?: Date;
}): Promise<CoachWaitlistEntryDocument> => {
  const now = params.now ?? new Date();

  const offering = await CoachOffering.findById(params.offeringId);
  if (!offering) throw new Error("Programme not found");
  if (offering.status !== "ACTIVE") {
    throw new Error("This programme is not open");
  }
  if (offering.enrolledCount < offering.capacity) {
    throw new Error(
      "There is a place available — you can join this programme now",
    );
  }

  // Already enrolled students have no business queueing for a second seat.
  const alreadyIn = await CoachEnrollment.exists({
    offeringId: params.offeringId,
    userId: params.userId,
    playerId: params.playerId ?? null,
    status: { $in: ["PENDING", "ACTIVE", "PAUSED"] },
  });
  if (alreadyIn) {
    throw new Error("You are already enrolled in this programme");
  }

  return CoachWaitlistEntry.create({
    offeringId: params.offeringId,
    coachId: offering.coachId,
    userId: params.userId,
    playerId: params.playerId ?? null,
    studentName: params.studentName,
    status: "WAITING",
    joinedAt: now,
  });
};

/** Step off the list. */
export const leaveWaitlist = async (params: {
  entryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  now?: Date;
}): Promise<boolean> => {
  const result = await CoachWaitlistEntry.findOneAndUpdate(
    {
      _id: params.entryId,
      userId: params.userId,
      status: { $in: ["WAITING", "NOTIFIED"] },
    },
    {
      $set: { status: "CANCELLED", leftAt: params.now ?? new Date() },
    },
  );

  return Boolean(result);
};

/**
 * Tell the waiting list that a seat has opened.
 *
 * Called wherever a seat is given back — a student leaving, an unpaid hold
 * expiring, a subscription ending. Safe to call when nothing actually freed:
 * it re-checks capacity first and does nothing if the programme is still full.
 */
export const notifyWaitlistOfFreeSeat = async (params: {
  offeringId: mongoose.Types.ObjectId;
  now?: Date;
}): Promise<number> => {
  const now = params.now ?? new Date();

  const offering = await CoachOffering.findById(params.offeringId)
    .select("_id title capacity enrolledCount status")
    .lean();
  if (!offering) return 0;
  if (offering.status !== "ACTIVE") return 0;
  if (offering.enrolledCount >= offering.capacity) return 0;

  const cooldownBefore = new Date(
    now.getTime() - WAITLIST_NOTIFY_COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  const waiting = await CoachWaitlistEntry.find({
    offeringId: params.offeringId,
    status: { $in: ["WAITING", "NOTIFIED"] },
    $or: [
      { lastNotifiedAt: null },
      { lastNotifiedAt: { $lte: cooldownBefore } },
    ],
  })
    .sort({ joinedAt: 1 })
    .limit(50);

  let notified = 0;
  for (const entry of waiting) {
    // Conditional claim so two sweeps cannot both send the same nudge.
    const claimed = await CoachWaitlistEntry.findOneAndUpdate(
      {
        _id: entry._id,
        $or: [
          { lastNotifiedAt: null },
          { lastNotifiedAt: { $lte: cooldownBefore } },
        ],
      },
      {
        $set: { status: "NOTIFIED", lastNotifiedAt: now },
        $inc: { notifyCount: 1 },
      },
    );
    if (!claimed) continue;
    notified += 1;

    notify(
      entry.userId,
      "BOOKING_STATUS_UPDATED",
      "A place has opened up",
      `A seat is free in ${offering.title}. Places go to whoever books first, so be quick.`,
      {
        offeringId: params.offeringId.toString(),
        waitlistEntryId: entry._id.toString(),
      },
      true,
    );
  }

  if (notified > 0) {
    log.info(
      `notifyWaitlistOfFreeSeat: told ${notified} person(s) about a seat in ${offering.title}`,
    );
  }

  return notified;
};

/**
 * Close out a waitlist entry once its owner has actually enrolled.
 *
 * Called after a successful enrolment so someone who got in is not still being
 * told about seats they no longer need.
 */
export const convertWaitlistEntry = async (params: {
  offeringId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  now?: Date;
}): Promise<boolean> => {
  const result = await CoachWaitlistEntry.findOneAndUpdate(
    {
      offeringId: params.offeringId,
      userId: params.userId,
      playerId: params.playerId ?? null,
      status: { $in: ["WAITING", "NOTIFIED"] },
    },
    { $set: { status: "CONVERTED", leftAt: params.now ?? new Date() } },
  );

  return Boolean(result);
};

/** What a coach sees: who is waiting, oldest first. */
export const waitlistForOffering = async (
  offeringId: mongoose.Types.ObjectId,
): Promise<CoachWaitlistEntryDocument[]> =>
  CoachWaitlistEntry.find({
    offeringId,
    status: { $in: ["WAITING", "NOTIFIED"] },
  })
    .sort({ joinedAt: 1 })
    .exec();

/** What a parent sees on their own account. */
export const waitlistEntriesForUser = async (
  userId: mongoose.Types.ObjectId,
): Promise<CoachWaitlistEntryDocument[]> =>
  CoachWaitlistEntry.find({
    userId,
    status: { $in: ["WAITING", "NOTIFIED"] },
  })
    .populate("offeringId")
    .sort({ joinedAt: 1 })
    .exec();
