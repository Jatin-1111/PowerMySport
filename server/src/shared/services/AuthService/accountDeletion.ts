import { Player } from "../../../client/models/Player";
import { User } from "../../../client/models/User";
import { S3Service } from "../S3Service";
import { log, ACCOUNT_DELETION_GRACE_PERIOD_MS } from "./shared";

/**
 * Step 1 of account deletion: verify the password and immediately lock the
 * account out (isActive=false, already enforced by authMiddleware on every
 * request) — but do NOT touch any PII yet. The user has a grace period
 * (ACCOUNT_DELETION_GRACE_PERIOD_MS) during which logging back in cancels
 * the pending deletion (see `loginUser` below). Only once
 * `finalizeAccountDeletion` runs, after the grace period elapses with no
 * recovery, does the account actually get anonymized/cascade-cleaned.
 */
export const requestAccountDeletion = async (
  userId: string,
  currentPassword: string
): Promise<void> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new Error("User not found");
  }

  if (user.password) {
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new Error("Password is incorrect");
    }
  }

  const now = new Date();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        isActive: false,
        pendingDeletion: true,
        deletionRequestedAt: now,
        deactivatedAt: now,
      },
    }
  );
};

/**
 * Step 2 of account deletion: called by the scheduled job
 * (`finalizePendingAccountDeletions` in scheduledJobs.ts) once the grace
 * period has elapsed with no recovery login. A hard delete of the User
 * document would orphan or corrupt historical Booking/Payment/Review
 * documents that reference it, and financial records need to survive for
 * tax/dispute purposes — so this anonymizes personally-identifying fields
 * on the User document itself (Booking/Payment history is intentionally
 * left untouched), then cascade-deletes the data that has no legal/
 * financial retention need (calendar events, friend requests, AI guidance
 * chat history, a parent's children's Player profiles, etc).
 *
 * NOTE: `delete user.field` on a Mongoose document does NOT issue an
 * $unset — it only removes the JS property from the in-memory object.
 * We use a single updateOne with $set + $unset to guarantee the fields
 * are actually removed from MongoDB.
 */
export const finalizeAccountDeletion = async (userId: string): Promise<void> => {
  const user = await User.findById(userId).select("_id");
  if (!user) return;

  const anonymizedTag = `deleted-${user._id.toString()}`;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: "Deleted User",
        email: `${anonymizedTag}@deleted.powermysport.com`,
        phone: anonymizedTag,
        isActive: false,
        pendingDeletion: false,
        deactivatedAt: new Date(),
        addresses: [],
        refundMethods: [],
        pushSubscriptions: [],
      },
      $unset: {
        password: "",
        googleId: "",
        photoUrl: "",
        photoS3Key: "",
        dob: "",
        city: "",
        defaultAddressId: "",
        shippingAddress: "",
        legalConsents: "",
        notificationPreferences: "",
        reminderPreferences: "",
        resetPasswordToken: "",
        resetPasswordExpires: "",
        parentProfile: "",
        playerProfile: "",
        bio: "",
        sportInterests: "",
        involvementYears: "",
        deletionRequestedAt: "",
      },
    }
  );

  // Cascade-delete data with no legal/financial retention need. Each is
  // independently try/caught so one failure doesn't block the rest —
  // matching the defensive style already used in runScheduledCleanup().
  const cascades: Array<[string, () => Promise<unknown>]> = [
    [
      "UserCalendarEvent",
      async () =>
        (await import("../../../client/models/UserCalendarEvent")).UserCalendarEvent.deleteMany({
          userId,
        }),
    ],
    [
      "FriendConnection",
      async () =>
        (await import("../../../client/models/FriendConnection")).default.deleteMany({
          $or: [{ requesterId: userId }, { recipientId: userId }],
        }),
    ],
    [
      "BookingWaitlist",
      async () =>
        (await import("../../../client/models/BookingWaitlist")).BookingWaitlist.deleteMany({
          userId,
        }),
    ],
    [
      "GuidanceSubmission",
      async () =>
        (await import("../../../client/models/GuidanceSubmission")).GuidanceSubmission.deleteMany({
          userId,
        }),
    ],
    [
      "GuidanceChatSession",
      async () =>
        (await import("../../../client/models/GuidanceChatSession")).GuidanceChatSession.deleteMany(
          {
            userId,
          }
        ),
    ],
    [
      "RoadmapChatSession",
      async () =>
        (await import("../../../client/models/RoadmapChatSession")).RoadmapChatSession.deleteMany({
          userId,
        }),
    ],
    [
      "PlanCheckIn",
      async () => (await import("../../models/PlanCheckIn")).PlanCheckIn.deleteMany({ userId }),
    ],
    [
      "UserPathwayProfile",
      async () =>
        (await import("../../models/UserPathwayProfile")).UserPathwayProfile.deleteMany({
          userId,
        }),
    ],
    ["Player", async () => Player.deleteMany({ userId })],
    [
      "Cart",
      async () => (await import("../../../shop/models/Ecommerce")).Cart.deleteMany({ userId }),
    ],
    [
      "Wishlist",
      async () =>
        (await import("../../../shop/models/Ecommerce")).Wishlist.deleteMany({
          userId,
        }),
    ],
    [
      "CommunityReputation",
      async () =>
        (
          await import("../../../community/models/CommunityReputation")
        ).CommunityReputation.deleteMany({ userId }),
    ],
    [
      "CommunityVote",
      async () =>
        (await import("../../../community/models/CommunityVote")).CommunityVote.deleteMany({
          userId,
        }),
    ],
    [
      "CommunityFollow",
      async () =>
        (await import("../../../community/models/CommunityFollow")).CommunityFollow.deleteMany({
          userId,
        }),
    ],
    [
      "CommunityGroupMember",
      async () =>
        (
          await import("../../../community/models/CommunityGroupMember")
        ).CommunityGroupMember.deleteMany({ userId }),
    ],
    [
      "BlogLike",
      async () =>
        (await import("../../../community/models/BlogLike")).BlogLike.deleteMany({
          userId,
        }),
    ],
    [
      "Notification",
      async () =>
        (await import("../../../client/models/Notification")).default.deleteMany({ userId }),
    ],
    [
      "ScheduledNotification (pending)",
      async () =>
        (
          await import("../../../client/models/ScheduledNotification")
        ).ScheduledNotification.deleteMany({ userId, status: "PENDING" }),
    ],
  ];

  for (const [label, run] of cascades) {
    try {
      await run();
    } catch (error) {
      log.error(`finalizeAccountDeletion: failed to clean up ${label} for user ${userId}:`, error);
    }
  }

  // ConciergeRequest also has uploaded documents in S3 — remove those before
  // dropping the Mongo records that reference them.
  try {
    const { ConciergeRequest } = await import("../../models/ConciergeRequest");
    const requests = await ConciergeRequest.find({ userId }).select("documents");
    const s3Service = new S3Service();
    for (const request of requests) {
      for (const doc of request.documents || []) {
        if (!doc.s3Key) continue;
        try {
          await s3Service.deleteFile(doc.s3Key, "documents");
        } catch (error) {
          log.error(
            `finalizeAccountDeletion: failed to delete S3 document ${doc.s3Key} for user ${userId}:`,
            error
          );
        }
      }
    }
    await ConciergeRequest.deleteMany({ userId });
  } catch (error) {
    log.error(
      `finalizeAccountDeletion: failed to clean up ConciergeRequest for user ${userId}:`,
      error
    );
  }

  // AnalyticsEvent is retained for aggregate value (it already supports a
  // pseudonymous guestId) — just strip the PII link, don't delete the event.
  try {
    const { AnalyticsEvent } = await import("../../../admin/models/AnalyticsEvent");
    await AnalyticsEvent.updateMany({ userId }, { $unset: { userId: "" } });
  } catch (error) {
    log.error(
      `finalizeAccountDeletion: failed to strip userId from AnalyticsEvent for user ${userId}:`,
      error
    );
  }
};

/**
 * Scheduled-job entry point (called from scheduledJobs.ts's
 * runScheduledCleanup, following the same shape as
 * ExpertsService.ts's expireUnpaidExpertHolds): finalizes any account whose
 * grace period has elapsed with no recovery login. Returns the count
 * finalized.
 */
export const finalizePendingAccountDeletions = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - ACCOUNT_DELETION_GRACE_PERIOD_MS);
  const candidates = await User.find({
    pendingDeletion: true,
    deletionRequestedAt: { $lte: cutoff },
  }).select("_id");

  for (const candidate of candidates) {
    try {
      await finalizeAccountDeletion(candidate._id.toString());
    } catch (error) {
      log.error(
        `finalizePendingAccountDeletions: failed to finalize user ${candidate._id.toString()}:`,
        error
      );
    }
  }

  return candidates.length;
};
