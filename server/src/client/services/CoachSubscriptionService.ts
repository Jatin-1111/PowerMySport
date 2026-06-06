import mongoose from "mongoose";
import { Coach } from "../models/Coach";
import {
  CoachSubscription,
  CoachSubscriptionDocument,
} from "../models/CoachSubscription";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { SubscriptionFrequency } from "../models/CoachSubscriptionPackage";

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

export const listCoachPlans = async (options?: {
  isActive?: boolean;
}): Promise<any[]> => {
  // Legacy method - kept for backward compatibility
  // New system uses CoachSubscriptionPackage instead
  return [];
};

export const createCoachPlan = async (payload: any): Promise<any> => {
  // Legacy method - kept for backward compatibility
  // New system uses CoachSubscriptionPackage instead
  throw new Error(
    "Coach plans are deprecated. Use CoachSubscriptionPackage instead",
  );
};

export const updateCoachPlan = async (
  planId: string,
  payload: any,
): Promise<any> => {
  // Legacy method - kept for backward compatibility
  throw new Error(
    "Coach plans are deprecated. Use CoachSubscriptionPackage instead",
  );
};

export const getMyCoachSubscription = async (
  userId: string,
): Promise<(CoachSubscriptionDocument & { package?: any }) | null> => {
  const coach = await Coach.findOne({ userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  return CoachSubscription.findOne({ coachId: coach._id })
    .sort({ createdAt: -1 })
    .populate("packageId");
};

/**
 * New method: Subscribe user to a coach's subscription package
 */
export const subscribeToCoachPackage = async (params: {
  userId: string;
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

  // Check for existing active subscription from this user to this coach
  const existingActive = await CoachSubscription.findOne({
    coachId: toObjectId(params.coachId),
    userId: toObjectId(params.userId),
    status: { $in: ["ACTIVE", "PAST_DUE"] },
  }).sort({ createdAt: -1 });

  if (
    existingActive &&
    existingActive.packageId.toString() === params.packageId &&
    existingActive.status === "ACTIVE"
  ) {
    const renewalStart =
      existingActive.currentPeriodEnd > now
        ? existingActive.currentPeriodEnd
        : now;

    existingActive.currentPeriodStart =
      existingActive.currentPeriodStart || now;
    existingActive.currentPeriodEnd = addBillingPeriod(
      renewalStart,
      packageDoc.frequency,
    );
    existingActive.nextBillingDate = existingActive.currentPeriodEnd;
    existingActive.autoRenew = true;
    existingActive.status = "ACTIVE";

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

  const subscription = await CoachSubscription.create({
    coachId: toObjectId(params.coachId),
    userId: toObjectId(params.userId),
    packageId: packageDoc._id,
    status: "ACTIVE",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    autoRenew: true,
  });

  const populated = await CoachSubscription.findById(subscription._id).populate(
    "packageId",
  );

  if (!populated) {
    throw new Error("Failed to create subscription");
  }

  await syncCoachSubscriptionSummary({
    coachId: toObjectId(params.coachId),
    subscriptionId: populated._id,
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: populated.currentPeriodEnd,
  });

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
    .sort({ createdAt: -1 });
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

    if (userRole === "PLAYER") {
      if (subscription.userId.toString() !== params.userId) {
        throw new Error("You are not authorized to cancel this subscription");
      }
    } else if (userRole === "COACH") {
      const coach = await Coach.findOne({ userId: params.userId }).select(
        "_id",
      );
      if (!coach || coach._id.toString() !== subscription.coachId.toString()) {
        throw new Error("You are not authorized to cancel this subscription");
      }
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

export const cleanupExpiredCoachSubscriptions = async (): Promise<number> => {
  const now = new Date();
  const expired = await CoachSubscription.find({
    status: { $in: ["ACTIVE", "PAST_DUE"] },
    $or: [
      { status: "ACTIVE", currentPeriodEnd: { $lte: now } },
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

export const listCoachSubscriptionsForAdmin = async (filters?: {
  status?: string;
  coachId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));

  const query: Record<string, unknown> = {};
  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.coachId) {
    query.coachId = toObjectId(filters.coachId);
  }
  if (filters?.userId) {
    query.userId = toObjectId(filters.userId);
  }

  const [subscriptions, total] = await Promise.all([
    CoachSubscription.find(query)
      .populate("packageId")
      .populate("coachId", "userId sports verificationStatus")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CoachSubscription.countDocuments(query),
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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
    .sort({ createdAt: -1 });
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
