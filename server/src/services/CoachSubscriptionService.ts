import mongoose from "mongoose";
import { Coach } from "../models/Coach";
import {
  CoachPlan,
  CoachPlanBillingCycle,
  CoachPlanDocument,
} from "../models/CoachPlan";
import {
  CoachSubscription,
  CoachSubscriptionDocument,
} from "../models/CoachSubscription";
import {
  CoachSubscriptionOverrideRequest,
  CoachSubscriptionOverrideRequestDocument,
  CoachSubscriptionOverrideStatus,
} from "../models/CoachSubscriptionOverrideRequest";

const DEFAULT_GRACE_DAYS = 7;

const addBillingPeriod = (
  startDate: Date,
  billingCycle: CoachPlanBillingCycle,
): Date => {
  const next = new Date(startDate);
  if (billingCycle === "YEARLY") {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  next.setMonth(next.getMonth() + 1);
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
}): Promise<CoachPlanDocument[]> => {
  const filters: Record<string, unknown> = {};

  if (typeof options?.isActive === "boolean") {
    filters.isActive = options.isActive;
  }

  return CoachPlan.find(filters).sort({ isActive: -1, createdAt: -1 });
};

export const createCoachPlan = async (payload: {
  code: string;
  name: string;
  description?: string;
  pricing: {
    monthly?: number;
    yearly?: number;
  };
  features?: string[];
  isActive?: boolean;
  supportsOverrides?: boolean;
}): Promise<CoachPlanDocument> => {
  if (!payload.pricing.monthly && !payload.pricing.yearly) {
    throw new Error("At least one pricing option is required");
  }

  const code = payload.code.trim().toUpperCase();
  const existingPlan = await CoachPlan.findOne({ code });
  if (existingPlan) {
    throw new Error("Coach plan with this code already exists");
  }

  return CoachPlan.create({
    ...payload,
    code,
    features: payload.features || [],
  });
};

export const updateCoachPlan = async (
  planId: string,
  payload: Partial<{
    name: string;
    description: string;
    pricing: {
      monthly?: number;
      yearly?: number;
    };
    features: string[];
    isActive: boolean;
    supportsOverrides: boolean;
  }>,
): Promise<CoachPlanDocument | null> => {
  const updatePayload = {
    ...payload,
  };

  return CoachPlan.findByIdAndUpdate(planId, updatePayload, {
    new: true,
    runValidators: true,
  });
};

export const getMyCoachSubscription = async (
  userId: string,
): Promise<CoachSubscriptionDocument | null> => {
  const coach = await Coach.findOne({ userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  return CoachSubscription.findOne({ coachId: coach._id })
    .sort({ createdAt: -1 })
    .populate("planId");
};

export const createOrUpdateCoachSubscription = async (params: {
  userId: string;
  planId: string;
  billingCycle: CoachPlanBillingCycle;
}): Promise<CoachSubscriptionDocument> => {
  const coach = await Coach.findOne({ userId: params.userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const plan = await CoachPlan.findById(params.planId);
  if (!plan || !plan.isActive) {
    throw new Error("Selected plan is not available");
  }

  const monthlySelected = params.billingCycle === "MONTHLY";
  if (monthlySelected && !plan.pricing.monthly) {
    throw new Error("Selected plan does not support monthly billing");
  }

  if (!monthlySelected && !plan.pricing.yearly) {
    throw new Error("Selected plan does not support yearly billing");
  }

  const now = new Date();
  const periodEnd = addBillingPeriod(now, params.billingCycle);

  const existingActive = await CoachSubscription.findOne({
    coachId: coach._id,
    status: { $in: ["ACTIVE", "PAST_DUE"] },
  }).sort({ createdAt: -1 });

  if (existingActive) {
    existingActive.status = "CANCELLED";
    existingActive.autoRenew = false;
    existingActive.cancelledAt = now;
    existingActive.cancellationReason = "Plan changed";
    await existingActive.save();
  }

  const subscription = await CoachSubscription.create({
    coachId: coach._id,
    userId: toObjectId(params.userId),
    planId: plan._id,
    status: "ACTIVE",
    billingCycle: params.billingCycle,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    autoRenew: true,
  });

  await syncCoachSubscriptionSummary({
    coachId: coach._id,
    subscriptionId: subscription._id,
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: periodEnd,
  });

  const populated = await CoachSubscription.findById(subscription._id).populate(
    "planId",
  );

  if (!populated) {
    throw new Error("Failed to create coach subscription");
  }

  return populated;
};

export const cancelCoachSubscriptionByUser = async (params: {
  userId: string;
  reason?: string;
}): Promise<CoachSubscriptionDocument> => {
  const coach = await Coach.findOne({ userId: params.userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const subscription = await CoachSubscription.findOne({
    coachId: coach._id,
    status: { $in: ["ACTIVE", "PAST_DUE"] },
  }).sort({ createdAt: -1 });

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  subscription.status = "CANCELLED";
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason =
    params.reason?.trim() || "Cancelled by coach";
  await subscription.save();

  await syncCoachSubscriptionSummary({
    coachId: coach._id,
    subscriptionId: subscription._id,
    subscriptionStatus: "CANCELLED",
    subscriptionExpiresAt: subscription.currentPeriodEnd,
  });

  return subscription;
};

export const markPastDueSubscription = async (subscriptionId: string) => {
  const subscription = await CoachSubscription.findById(subscriptionId);
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

export const listCoachSubscriptionsForAdmin = async (filters?: {
  status?: string;
  planId?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));

  const query: Record<string, unknown> = {};
  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.planId) {
    query.planId = filters.planId;
  }

  const [subscriptions, total] = await Promise.all([
    CoachSubscription.find(query)
      .populate("planId", "code name pricing")
      .populate("coachId", "userId sports verificationStatus")
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

export const createCoachSubscriptionOverrideRequest = async (params: {
  userId: string;
  requestedPlanId?: string;
  note: string;
}): Promise<CoachSubscriptionOverrideRequestDocument> => {
  const coach = await Coach.findOne({ userId: params.userId }).select(
    "_id activeSubscriptionId",
  );

  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const activeRequest = await CoachSubscriptionOverrideRequest.findOne({
    coachId: coach._id,
    status: "PENDING",
  });

  if (activeRequest) {
    throw new Error("A pending override request already exists");
  }

  let currentPlanId: mongoose.Types.ObjectId | null = null;
  if (coach.activeSubscriptionId) {
    const subscription = await CoachSubscription.findById(
      coach.activeSubscriptionId,
    ).select("planId");
    currentPlanId = subscription?.planId || null;
  }

  const requestedPlanObjectId = params.requestedPlanId
    ? toObjectId(params.requestedPlanId)
    : null;

  return CoachSubscriptionOverrideRequest.create({
    coachId: coach._id,
    userId: toObjectId(params.userId),
    currentPlanId,
    requestedPlanId: requestedPlanObjectId,
    note: params.note.trim(),
    status: "PENDING",
  });
};

export const listOverrideRequestsForCoach = async (params: {
  userId: string;
  status?: CoachSubscriptionOverrideStatus;
  page?: number;
  limit?: number;
}) => {
  const coach = await Coach.findOne({ userId: params.userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));

  const query: Record<string, unknown> = {
    coachId: coach._id,
  };

  if (params.status) {
    query.status = params.status;
  }

  const [requests, total] = await Promise.all([
    CoachSubscriptionOverrideRequest.find(query)
      .populate("currentPlanId", "code name")
      .populate("requestedPlanId", "code name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CoachSubscriptionOverrideRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const listOverrideRequestsForAdmin = async (filters?: {
  status?: CoachSubscriptionOverrideStatus;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));
  const query: Record<string, unknown> = {};

  if (filters?.status) {
    query.status = filters.status;
  }

  const [requests, total] = await Promise.all([
    CoachSubscriptionOverrideRequest.find(query)
      .populate("coachId", "userId sports verificationStatus")
      .populate("currentPlanId", "code name")
      .populate("requestedPlanId", "code name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CoachSubscriptionOverrideRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const reviewOverrideRequest = async (params: {
  requestId: string;
  reviewerId: string;
  status: Exclude<CoachSubscriptionOverrideStatus, "PENDING">;
  reviewNote?: string;
}) => {
  const request = await CoachSubscriptionOverrideRequest.findById(
    params.requestId,
  );
  if (!request) {
    throw new Error("Override request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error("Override request has already been reviewed");
  }

  request.status = params.status;
  request.reviewedBy = toObjectId(params.reviewerId);
  request.reviewedAt = new Date();
  request.reviewNote = params.reviewNote?.trim() || "";
  await request.save();

  return request;
};
