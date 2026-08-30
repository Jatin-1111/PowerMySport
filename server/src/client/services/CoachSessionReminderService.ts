import mongoose from "mongoose";
import { Coach } from "../models/Coach";
import { CoachSessionOccurrence } from "../models/CoachSessionOccurrence";
import { NotificationType } from "../models/Notification";
import { NotificationService } from "./NotificationService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachSessionReminders");

/**
 * Session-connection reminders for recurring coaching.
 *
 * Deliberately NOT a generalisation of the expert reminder jobs. Those run over
 * a 1:1 consultation with a single client; a coaching occurrence has a roster,
 * and the messages differ in what they say and who they go to. What is shared
 * is the *shape* — a one-shot, deduped-by-timestamp sweep — not the code.
 *
 * The link nudge exists because an online session with no meeting link is a
 * session that silently does not happen. In-person coaching has no equivalent
 * failure: the address was fixed when the offering was created.
 */

const MINUTE_MS = 60_000;

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
    log.error("[coachSessions] notification failed:", err),
  );
};

const coachUserIdOf = async (
  coachId: mongoose.Types.ObjectId,
): Promise<string | null> => {
  const coach = await Coach.findById(coachId).select("userId").lean();
  return coach ? (coach.userId as mongoose.Types.ObjectId).toString() : null;
};

const formatWhen = (at: Date, timeZone = "Asia/Kolkata"): string =>
  new Date(at).toLocaleString("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * Nudge the coach when an ONLINE session is starting soon and still has no
 * meeting link.
 *
 * Fires once per occurrence, deduped by `meetingLinkNudgeSentAt`, and the
 * dedup write is a conditional findOneAndUpdate so two overlapping sweeps
 * cannot both send it.
 */
export const sendCoachMeetingLinkNudges = async (params: {
  now?: Date;
  windowHours?: number;
} = {}): Promise<number> => {
  const now = params.now ?? new Date();
  const soon = new Date(now.getTime() + (params.windowHours ?? 3) * 60 * MINUTE_MS);

  const candidates = await CoachSessionOccurrence.find({
    status: "SCHEDULED",
    "delivery.kind": "ONLINE",
    $or: [
      { "delivery.meetingLink": { $exists: false } },
      { "delivery.meetingLink": "" },
      { "delivery.meetingLink": null },
    ],
    scheduledAt: { $gte: now, $lte: soon },
    meetingLinkNudgeSentAt: null,
  }).select("_id coachId scheduledAt");

  let count = 0;
  for (const occurrence of candidates) {
    const claimed = await CoachSessionOccurrence.findOneAndUpdate(
      { _id: occurrence._id, meetingLinkNudgeSentAt: null },
      { $set: { meetingLinkNudgeSentAt: now } },
    );
    if (!claimed) continue;
    count += 1;

    const coachUserId = await coachUserIdOf(occurrence.coachId);
    if (!coachUserId) continue;

    notify(
      coachUserId,
      "SESSION_LINK_REQUIRED",
      "Add your class link",
      `Your online class on ${formatWhen(occurrence.scheduledAt)} is coming up and still has no meeting link.`,
      { occurrenceId: occurrence._id.toString() },
      true,
    );
  }

  if (count > 0) log.info(`sendCoachMeetingLinkNudges: nudged ${count} session(s)`);
  return count;
};

/**
 * "Your class starts soon", to the coach and to every student on the roster,
 * carrying whatever connection detail the delivery kind implies.
 *
 * Fires once per occurrence, deduped by `startReminderSentAt`.
 */
export const sendCoachSessionStartReminders = async (params: {
  now?: Date;
  windowHours?: number;
} = {}): Promise<number> => {
  const now = params.now ?? new Date();
  const soon = new Date(now.getTime() + (params.windowHours ?? 2) * 60 * MINUTE_MS);

  const candidates = await CoachSessionOccurrence.find({
    status: "SCHEDULED",
    scheduledAt: { $gte: now, $lte: soon },
    startReminderSentAt: null,
  });

  let count = 0;
  for (const occurrence of candidates) {
    const claimed = await CoachSessionOccurrence.findOneAndUpdate(
      { _id: occurrence._id, startReminderSentAt: null },
      { $set: { startReminderSentAt: now } },
    );
    if (!claimed) continue;
    count += 1;

    const when = formatWhen(occurrence.scheduledAt);
    const detail = connectionDetailFor(occurrence.delivery);

    for (const seat of occurrence.roster) {
      notify(
        seat.userId,
        "BOOKING_REMINDER",
        "Your class starts soon",
        `${occurrence.sport} class at ${when}.${detail.student}`,
        { occurrenceId: occurrence._id.toString() },
        true,
      );
    }

    const coachUserId = await coachUserIdOf(occurrence.coachId);
    if (coachUserId) {
      notify(
        coachUserId,
        "BOOKING_REMINDER",
        "Your class starts soon",
        `${occurrence.sport} class at ${when} with ${occurrence.roster.length} student(s).${detail.coach}`,
        { occurrenceId: occurrence._id.toString() },
        false,
      );
    }
  }

  if (count > 0) {
    log.info(`sendCoachSessionStartReminders: reminded ${count} session(s)`);
  }
  return count;
};

/**
 * What each party needs in order to actually turn up. An online session with no
 * link says so plainly rather than sending an empty reminder — a parent who is
 * told nothing assumes the class is cancelled.
 */
const connectionDetailFor = (
  delivery: { kind?: string; meetingLink?: string; addressSnapshot?: string } | undefined,
): { student: string; coach: string } => {
  if (!delivery) return { student: "", coach: "" };

  if (delivery.kind === "ONLINE") {
    return delivery.meetingLink
      ? {
          student: ` Join here: ${delivery.meetingLink}`,
          coach: ` Link: ${delivery.meetingLink}`,
        }
      : {
          student:
            " Your coach hasn't shared the class link yet — check back shortly.",
          coach: " You still need to add a meeting link.",
        };
  }

  if (delivery.addressSnapshot) {
    return {
      student: ` Where: ${delivery.addressSnapshot}`,
      coach: ` Where: ${delivery.addressSnapshot}`,
    };
  }

  return { student: "", coach: "" };
};
