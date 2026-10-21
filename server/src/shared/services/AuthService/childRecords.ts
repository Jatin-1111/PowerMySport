import type mongoose from "mongoose";
import { Booking } from "../../../client/models/Booking";
import { CoachEnrollment } from "../../../client/models/CoachEnrollment";
import { CoachSessionCredit } from "../../../client/models/CoachSessionCredit";
import { CoachWaitlistEntry } from "../../../client/models/CoachWaitlistEntry";
import { ExpertSession } from "../../../client/models/ExpertBooking";
import { AppError } from "../../../utils/AppError";
import { resolveChildAge } from "../../../utils/childAge";

/**
 * Everything in the database that names a child, and what deleting the child does to it.
 *
 * `deleteDependent` walks this list; it holds no list of its own. A test finds every
 * model field that points at a child and fails when one is missing here, so a new
 * feature that stores a child's id cannot ship without someone deciding what happens to
 * it on delete. That is how guidance submissions, check-ins and expert sessions were each
 * missed in turn before this list existed.
 *
 * Three kinds of rule:
 *  - `remove`: the rows go with the child.
 *  - `protect`: the rows are about to matter (an open booking or session), so the delete
 *    is refused while they do; `settle` then runs just before the profile goes.
 *  - `keep`: the rows stay, for the reason given (money and legal records, or rows that
 *    already carry the child's name themselves).
 *
 * This is for deleting ONE child. Deleting a whole account is `cascadeDeleteUserData`,
 * which removes by owner and does not need to know about children.
 */

export interface ChildRecordContext {
  userId: string;
  /** The child's profile, still present: protect and settle run before it is deleted. */
  child: { _id: mongoose.Types.ObjectId; name?: string } & Parameters<typeof resolveChildAge>[0];
}

interface RuleBase {
  /** The Mongoose model name, exactly as registered. */
  model: string;
  /** The path on that model that holds the child's id. */
  field: string;
  /** In plain words: what happens to these rows, and why. */
  why: string;
}

export type ChildRecordRule = RuleBase &
  (
    | { action: "remove"; run: (context: ChildRecordContext) => Promise<unknown> }
    | {
        action: "protect";
        check?: (context: ChildRecordContext) => Promise<void>;
        settle?: (context: ChildRecordContext) => Promise<unknown>;
      }
    | { action: "keep" }
  );

const idOf = (context: ChildRecordContext): string => String(context.child._id);

export const CHILD_RECORDS: ChildRecordRule[] = [
  {
    model: "PlayerRankingLink",
    field: "dependentId",
    action: "remove",
    why: "A link outlives nothing: it would keep that registration number locked against a later, legitimate claim.",
    run: async (context) => {
      const { RankingClaimService } = await import("../../../client/services/RankingClaimService");
      return RankingClaimService.removeForDependent(idOf(context));
    },
  },
  {
    model: "SeasonPlan",
    field: "dependentId",
    action: "remove",
    why: "The plan names a child who no longer has a profile, and its unique key would block a plan for a profile created later.",
    run: async (context) => {
      const { SeasonPlanService } = await import("../../../client/services/SeasonPlanService");
      return SeasonPlanService.removeForDependent(idOf(context));
    },
  },
  {
    model: "PlanCheckIn",
    field: "dependentId",
    action: "remove",
    why: "A check-in has a queued email behind it; removing only the check-in would leave an email asking how a deleted child's sport is going.",
    run: async ({ userId, child }) => {
      const dependentId = String(child._id);
      const { PlanCheckIn } = await import("../../models/PlanCheckIn");
      const { ScheduledNotification } =
        await import("../../../client/models/ScheduledNotification");
      const checkIns = await PlanCheckIn.find({ userId, dependentId }).select("_id").lean();
      const ids = checkIns.map((checkIn) => checkIn._id.toString());
      if (ids.length > 0) {
        await ScheduledNotification.deleteMany({
          userId,
          type: "PLAN_CHECKIN",
          status: "PENDING",
          "data.checkInId": { $in: ids },
        });
      }
      return PlanCheckIn.deleteMany({ userId, dependentId });
    },
  },
  {
    model: "GuidanceSubmission",
    field: "request.dependent_id",
    action: "remove",
    why: "The stored questionnaire carries the child's age, gender and the parent's own words; the follow-up chat on it goes with it. Retention: submissions have no timer and are kept until the child or the account is deleted (decided 2026-10-21); chats expire 180 days after the last message (migrations 55 and 63).",
    run: async ({ userId, child }) => {
      const dependentId = String(child._id);
      const { GuidanceSubmission } = await import("../../../client/models/GuidanceSubmission");
      const { GuidanceChatSession } = await import("../../../client/models/GuidanceChatSession");
      const submissions = await GuidanceSubmission.find({
        userId,
        "request.dependent_id": dependentId,
      })
        .select("_id")
        .lean();
      const ids = submissions.map((submission) => submission._id);
      if (ids.length > 0) {
        await GuidanceChatSession.deleteMany({ userId, submissionId: { $in: ids } });
      }
      return GuidanceSubmission.deleteMany({ userId, "request.dependent_id": dependentId });
    },
  },
  {
    model: "ScreeningRequest",
    field: "dependentId",
    action: "remove",
    why: "A request names the child and carries the parent's phone number.",
    run: async (context) =>
      (await import("../../../client/models/ScreeningRequest")).ScreeningRequest.deleteMany({
        dependentId: idOf(context),
      }),
  },
  {
    model: "Booking",
    field: "participantId",
    action: "protect",
    why: "A venue or coach booking is a paid record that already stores the child's name and age; deleting the profile is refused while any exists.",
    check: async (context) => {
      const bookingCount = await Booking.countDocuments({ participantId: idOf(context) });
      if (bookingCount > 0) {
        throw new Error(
          `Cannot delete dependent with ${bookingCount} active booking(s). Please cancel or complete these bookings first.`
        );
      }
    },
  },
  {
    model: "ExpertSession",
    field: "playerId",
    action: "protect",
    why: "An open session is prepared from the child's profile and a paid one cannot lose who it was for, so it blocks the delete. Finished sessions keep the name and age and lose the link.",
    check: async (context) => {
      const openSessions = await ExpertSession.countDocuments({
        playerId: context.child._id,
        $or: [
          { status: { $in: ["PAID", "SCHEDULED"] } },
          { status: "PENDING_PAYMENT", holdExpiresAt: { $gt: new Date() } },
        ],
      });
      if (openSessions > 0) {
        throw new AppError(
          `Cannot delete ${context.child.name} while ${openSessions} expert session(s) for them are still open. Delete the profile after they are completed or cancelled.`,
          409
        );
      }
    },
    settle: async ({ child }) =>
      ExpertSession.updateMany(
        { playerId: child._id },
        {
          $set: { playerSnapshot: { name: child.name, age: resolveChildAge(child) } },
          $unset: { playerId: "" },
        }
      ),
  },
  {
    model: "CoachEnrollment",
    field: "playerId",
    action: "protect",
    why: "A live enrolment is a recurring subscription the parent pays for and a seat the coach counts on, so it blocks the delete until the parent cancels it, which runs the refund flow. Finished enrolments are kept and already store the child's name (studentName).",
    check: async ({ child }) => {
      const now = new Date();
      const live = await CoachEnrollment.countDocuments({
        playerId: child._id,
        $or: [
          { status: { $in: ["ACTIVE", "PAUSED"] } },
          {
            status: "PENDING",
            $or: [{ holdExpiresAt: null }, { holdExpiresAt: { $gt: now } }],
          },
        ],
      });
      if (live > 0) {
        throw new AppError(
          `Cannot delete ${child.name} while ${live} coaching enrolment(s) for them are still active. Cancel the enrolment first, then delete the profile.`,
          409
        );
      }
    },
  },
  {
    model: "CoachSessionOccurrence",
    field: "roster.playerId",
    action: "keep",
    why: "The roster is a snapshot of who was in a coaching session, so a later change cannot rewrite who attended; it already stores the child's name (studentName).",
  },
  {
    model: "CoachWaitlistEntry",
    field: "playerId",
    action: "protect",
    why: "A waiting-list place has no seat and no money, so deleting the child cancels it and the coach stops notifying a profile that is gone. Finished entries are kept as history and store the child's name (studentName).",
    settle: async ({ child }) =>
      CoachWaitlistEntry.updateMany(
        { playerId: child._id, status: { $in: ["WAITING", "NOTIFIED"] } },
        { $set: { status: "CANCELLED", leftAt: new Date() } }
      ),
  },
  {
    model: "CoachSessionCredit",
    field: "playerId",
    action: "protect",
    why: "An unused credit is a prepaid session and a pending refund is money owed back, so either blocks the delete. Consumed, expired and refunded credits are the ledger, kept for tax and dispute purposes.",
    check: async ({ child }) => {
      const open = await CoachSessionCredit.countDocuments({
        playerId: child._id,
        status: { $in: ["AVAILABLE", "REFUND_PENDING"] },
      });
      if (open > 0) {
        throw new AppError(
          `Cannot delete ${child.name} while they have unused coaching credits or a refund still being settled. Use or refund them first, then delete the profile.`,
          409
        );
      }
    },
  },
  {
    model: "CoachSubscription",
    field: "dependentId",
    action: "keep",
    why: "A paid subscription; kept for tax and dispute purposes.",
  },
  {
    model: "CoachSubscriptionPaymentTransaction",
    field: "dependentId",
    action: "keep",
    why: "A payment record; kept for tax and dispute purposes.",
  },
];
