import mongoose from "mongoose";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import {
  sendCoachSubscriptionPurchasedEmail,
  sendCoachSubscriptionCancelledEmail,
} from "../../utils/email";
import {
  CoachSubscription,
  CoachSubscriptionDocument,
} from "../models/CoachSubscription";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { SubscriptionFrequency } from "../models/CoachSubscriptionPackage";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("coachSubscription");

const DEFAULT_GRACE_DAYS = 7;

const addBillingPeriod = (
  startDate: Date,
  frequency: SubscriptionFrequency,
): Date => {
  const next = new Date(startDate);
  switch (frequency) {
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "MONTHLY":
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
};

const addGracePeriod = (startDate: Date, days: number): Date => {
  const next = new Date(startDate);
  next.setDate(next.getDate() + days);
  return next;
};

const toObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  return new mongoose.Types.ObjectId(id);
};

const syncCoachSubscriptionSummary = async (params: {
  coachId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId | null;
  subscriptionStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  subscriptionExpiresAt?: Date | null;
}): Promise<void> => {
  await Coach.findByIdAndUpdate(params.coachId, {
    activeSubscriptionId: params.subscriptionId || null,
    subscriptionStatus: params.subscriptionStatus,
    subscriptionExpiresAt: params.subscriptionExpiresAt || null,
  });
};

/**
 * New method: Subscribe user to a coach's subscription package
 */
export const subscribeToCoachPackage = async (params: {
  userId: string;
  dependentId?: string;
  coachId: string;
  packageId: string;
}): Promise<CoachSubscriptionDocument> => {
  const packageDoc = await CoachSubscriptionPackage.findById(
    toObjectId(params.packageId),
  );

  if (!packageDoc || !packageDoc.isActive) {
    throw new Error("Selected package is not available");
  }

  if (packageDoc.coachId.toString() !== params.coachId) {
    throw new Error("Package does not belong to this coach");
  }

  const now = new Date();
  const periodEnd = addBillingPeriod(now, packageDoc.frequency);

  const query: any = {
    coachId: toObjectId(params.coachId),
    userId: toObjectId(params.userId),
    status: { $in: ["ACTIVE", "PAST_DUE"] },
  };

  if (params.dependentId) {
    query.dependentId = toObjectId(params.dependentId);
  } else {
    query.dependentId = { $exists: false };
  }

  // Check for existing active subscription from this user to this coach
  const existingActive = await CoachSubscription.findOne(query).sort({
    createdAt: -1,
  });

  if (
    existingActive &&
    existingActive.packageId.toString() === params.packageId &&
    existingActive.status === "ACTIVE"
  ) {
    const renewalStart =
      existingActive.currentPeriodEnd > now
        ? existingActive.currentPeriodEnd
        : now;

    // The new period STARTS where the old one ended. This used to leave
    // `currentPeriodStart` pinned to the original signup while
    // `currentPeriodEnd` advanced, so after one renewal the "current period"
    // spanned every month since the beginning — which the field name already
    // said it should not.
    //
    // It matters beyond tidiness: recurring-programme credits are granted for
    // exactly this window, so a stale start would buy one month's fee a
    // multi-month run of classes.
    existingActive.currentPeriodStart = renewalStart;
    existingActive.currentPeriodEnd = addBillingPeriod(
      renewalStart,
      packageDoc.frequency,
    );
    existingActive.nextBillingDate = existingActive.currentPeriodEnd;
    existingActive.autoRenew = true;
    existingActive.status = "ACTIVE";
    // A grace window that was open is now closed, and the next period gets its
    // own nudge.
    existingActive.gracePeriodEndsAt = null;
    existingActive.renewalReminderSentAt = null;

    await existingActive.save();

    await syncCoachSubscriptionSummary({
      coachId: toObjectId(params.coachId),
      subscriptionId: existingActive._id,
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: existingActive.currentPeriodEnd,
    });
    return existingActive;
  }

  if (existingActive) {
    existingActive.status = "CANCELLED";
    existingActive.autoRenew = false;
    existingActive.cancelledAt = now;
    existingActive.cancellationReason = "Switched to different package";
    await existingActive.save();
  }

  const newSubscription = await CoachSubscription.create({
    coachId: toObjectId(params.coachId),
    userId: toObjectId(params.userId),
    ...(params.dependentId
      ? { dependentId: toObjectId(params.dependentId) }
      : {}),
    packageId: packageDoc._id,
    status: "ACTIVE",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    autoRenew: true,
  });

  const populated = await CoachSubscription.findById(
    newSubscription._id,
  ).populate("packageId");

  if (!populated) {
    throw new Error("Failed to create subscription");
  }

  await syncCoachSubscriptionSummary({
    coachId: toObjectId(params.coachId),
    subscriptionId: newSubscription._id,
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: populated.currentPeriodEnd,
  });

  // Notify both parties of the new subscription (fire-and-forget).
  void (async () => {
    try {
      const player = await User.findById(params.userId)
        .select("name email")
        .lean();
      const coach = await Coach.findById(params.coachId)
        .populate("userId", "name email")
        .lean();
      const coachUser = coach?.userId as unknown as {
        name?: string;
        email?: string;
      } | null;
      const priceRupees = (packageDoc.price || 0) / 100;
      if (player?.email) {
        await sendCoachSubscriptionPurchasedEmail({
          name: player.name,
          email: player.email,
          packageName: packageDoc.name,
          price: priceRupees,
          counterpartName: coachUser?.name || "your coach",
          recipientRole: "Player",
        });
      }
      if (coachUser?.email) {
        await sendCoachSubscriptionPurchasedEmail({
          name: coachUser.name,
          email: coachUser.email,
          packageName: packageDoc.name,
          price: priceRupees,
          counterpartName: player?.name || "A player",
          recipientRole: "Coach",
        });
      }
    } catch (emailError) {
      log.error("Failed to send subscription purchased email:", emailError);
    }
  })();

  return populated;
};

/**
 * Get user's subscriptions to a specific coach
 */
export const getUserCoachSubscriptions = async (params: {
  userId: string;
  coachId?: string;
  status?: string;
}): Promise<CoachSubscriptionDocument[]> => {
  const query: Record<string, any> = {
    userId: toObjectId(params.userId),
  };

  if (params.coachId) {
    query.coachId = toObjectId(params.coachId);
  }

  if (params.status) {
    query.status = params.status;
  }

  return CoachSubscription.find(query)
    .populate("packageId")
    .populate("coachId", "bio sports rating reviewCount")
    .sort({ createdAt: -1 })
    .lean();
};

export const cancelCoachSubscriptionByUser = async (params: {
  subscriptionId: string;
  reason?: string;
  userId?: string;
  userRole?: string;
}): Promise<CoachSubscriptionDocument> => {
  const subscription = await CoachSubscription.findById(
    toObjectId(params.subscriptionId),
  );

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (subscription.status === "CANCELLED") {
    throw new Error("Subscription is already cancelled");
  }

  if (params.userId) {
    const userRole = typeof params.userRole === "string" ? params.userRole : "";

    if (userRole === "Player" || userRole === "Parent") {
      if (subscription.userId.toString() !== params.userId) {
        throw new Error("You are not authorized to cancel this subscription");
      }
    } else if (userRole === "Coach") {
      const coach = await Coach.findOne({ userId: params.userId }).select(
        "_id",
      );
      if (!coach || coach._id.toString() !== subscription.coachId.toString()) {
        throw new Error("You are not authorized to cancel this subscription");
      }
    } else {
      // Any role outside the two ownership shapes we know how to verify
      // (e.g. VenueLister, Academy, Admin acting without going through the
      // admin surface) has no legitimate claim to this subscription — the
      // absence of a matching branch above must never mean "unauthorized
      // checks skipped", it must mean "deny by default".
      throw new Error("You are not authorized to cancel this subscription");
    }
  }

  subscription.status = "CANCELLED";
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason =
    params.reason?.trim() || "Cancelled by user";
  await subscription.save();

  await syncCoachSubscriptionSummary({
    coachId: subscription.coachId,
    subscriptionId: null,
    subscriptionStatus: "CANCELLED",
    subscriptionExpiresAt: subscription.currentPeriodEnd,
  });

  // Notify the subscriber their plan was cancelled (fire-and-forget).
  void (async () => {
    try {
      const player = await User.findById(subscription.userId)
        .select("name email")
        .lean();
      const coach = await Coach.findById(subscription.coachId)
        .populate("userId", "name")
        .lean();
      const pkg = await CoachSubscriptionPackage.findById(
        subscription.packageId,
      )
        .select("name")
        .lean();
      const coachUser = coach?.userId as unknown as { name?: string } | null;
      if (player?.email) {
        await sendCoachSubscriptionCancelledEmail({
          name: player.name,
          email: player.email,
          packageName: pkg?.name || "coaching plan",
          counterpartName: coachUser?.name || "your coach",
          recipientRole: "Player",
        });
      }
    } catch (emailError) {
      log.error("Failed to send subscription cancelled email:", emailError);
    }
  })();

  return subscription;
};

/**
 * Cancel all active subscriptions from a user to a coach
 */
export const cancelAllUserCoachSubscriptions = async (params: {
  userId: string;
  coachId: string;
  reason?: string;
}): Promise<CoachSubscriptionDocument[]> => {
  const subscriptions = await CoachSubscription.updateMany(
    {
      userId: toObjectId(params.userId),
      coachId: toObjectId(params.coachId),
      status: { $in: ["ACTIVE", "PAST_DUE"] },
    },
    {
      status: "CANCELLED",
      autoRenew: false,
      cancelledAt: new Date(),
      cancellationReason: params.reason?.trim() || "Cancelled by user",
    },
  );

  return CoachSubscription.find({
    userId: toObjectId(params.userId),
    coachId: toObjectId(params.coachId),
    status: "CANCELLED",
  })
    .sort({ updatedAt: -1 })
    .limit(subscriptions.modifiedCount);
};

export const markPastDueSubscription = async (subscriptionId: string) => {
  const subscription = await CoachSubscription.findById(
    toObjectId(subscriptionId),
  );
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  subscription.status = "PAST_DUE";
  subscription.gracePeriodEndsAt = addGracePeriod(
    new Date(),
    parseInt(
      process.env.COACH_SUBSCRIPTION_GRACE_PERIOD_DAYS ||
        String(DEFAULT_GRACE_DAYS),
      10,
    ),
  );
  await subscription.save();

  await syncCoachSubscriptionSummary({
    coachId: subscription.coachId,
    subscriptionId: subscription._id,
    subscriptionStatus: "PAST_DUE",
    subscriptionExpiresAt: subscription.currentPeriodEnd,
  });

  return subscription;
};

/**
 * Move auto-renewing subscriptions whose period has ended into PAST_DUE, with a
 * grace window, instead of killing them outright.
 *
 * `autoRenew` was previously written as `true` and then ignored: the expiry
 * sweep killed every subscription the moment its period ended, so a renewal was
 * impossible by construction. There is no payment mandate in this integration
 * (PhonePeService has no autopay/subscription API), so "auto-renew" can only
 * mean "we hold your place and ask you to pay", not "we take the money" — and
 * the grace window is what makes that honest rather than a hard cut-off at
 * midnight.
 *
 * A subscription that is NOT auto-renewing still expires directly, which is
 * what the user asked for when they turned it off.
 */
export const lapseRenewableSubscriptionsToPastDue = async (params: {
  now?: Date;
  graceDays?: number;
} = {}): Promise<number> => {
  const now = params.now ?? new Date();
  const graceDays = params.graceDays ?? DEFAULT_GRACE_DAYS;

  const due = await CoachSubscription.find({
    status: "ACTIVE",
    autoRenew: true,
    currentPeriodEnd: { $lte: now },
  });

  for (const subscription of due) {
    subscription.status = "PAST_DUE";
    subscription.gracePeriodEndsAt = addGracePeriod(now, graceDays);
    await subscription.save();

    await syncCoachSubscriptionSummary({
      coachId: subscription.coachId,
      subscriptionId: subscription._id as mongoose.Types.ObjectId,
      subscriptionStatus: "PAST_DUE",
      subscriptionExpiresAt: subscription.currentPeriodEnd,
    });
  }

  if (due.length > 0) {
    log.info(
      `lapseRenewableSubscriptionsToPastDue: ${due.length} subscription(s) now awaiting renewal`,
    );
  }

  return due.length;
};

export const cleanupExpiredCoachSubscriptions = async (params: {
  now?: Date;
} = {}): Promise<number> => {
  // Injectable so the expiry/grace boundaries can actually be tested; the job
  // calls it with no argument and gets the real clock.
  const now = params.now ?? new Date();
  const expired = await CoachSubscription.find({
    status: { $in: ["ACTIVE", "PAST_DUE"] },
    $or: [
      // Auto-renewing subscriptions are handed to the grace window above
      // first; only ones the user actually turned off die at period end.
      { status: "ACTIVE", autoRenew: { $ne: true }, currentPeriodEnd: { $lte: now } },
      { status: "PAST_DUE", gracePeriodEndsAt: { $lte: now } },
    ],
  });

  if (expired.length === 0) {
    return 0;
  }

  const coachIds = new Set<string>();

  for (const subscription of expired) {
    subscription.status = "EXPIRED";
    subscription.autoRenew = false;
    if (!subscription.cancelledAt) {
      subscription.cancelledAt = now;
    }
    subscription.cancellationReason =
      subscription.cancellationReason || "Subscription expired";
    await subscription.save();
    coachIds.add(subscription.coachId.toString());
  }

  for (const coachId of coachIds) {
    const activeSubscription = await CoachSubscription.findOne({
      coachId: toObjectId(coachId),
      status: "ACTIVE",
    })
      .sort({ currentPeriodEnd: -1 })
      .lean();

    await syncCoachSubscriptionSummary({
      coachId: toObjectId(coachId),
      subscriptionId: activeSubscription?._id ?? null,
      subscriptionStatus: activeSubscription ? "ACTIVE" : "EXPIRED",
      subscriptionExpiresAt: activeSubscription?.currentPeriodEnd ?? null,
    });
  }

  return expired.length;
};

/**
 * Get active subscriptions for a coach
 */
export const getCoachActiveSubscriptions = async (coachId: string) => {
  return CoachSubscription.find({
    coachId: toObjectId(coachId),
    status: "ACTIVE",
  })
    .populate("userId", "name email")
    .populate("packageId")
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Get subscription revenue for a coach
 */
export const getCoachSubscriptionRevenue = async (params: {
  coachId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total: number;
  count: number;
  byFrequency: Record<string, number>;
}> => {
  const query: Record<string, any> = {
    coachId: toObjectId(params.coachId),
    status: "ACTIVE",
  };

  if (params.startDate || params.endDate) {
    query.createdAt = {};
    if (params.startDate) {
      query.createdAt.$gte = params.startDate;
    }
    if (params.endDate) {
      query.createdAt.$lte = params.endDate;
    }
  }

  const subscriptions = await CoachSubscription.find(query).populate(
    "packageId",
    "price frequency",
  );

  let total = 0;
  const byFrequency: Record<string, number> = {
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
  };

  for (const sub of subscriptions) {
    const pkg = sub.packageId as any;
    if (pkg && pkg.price) {
      total += pkg.price;
      byFrequency[pkg.frequency] =
        (byFrequency[pkg.frequency] || 0) + pkg.price;
    }
  }

  return {
    total,
    count: subscriptions.length,
    byFrequency,
  };
};
