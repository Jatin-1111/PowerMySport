import { Request, Response } from "express";
import {
  cancelCoachSubscriptionByUser,
  createCoachPlan,
  getMyCoachSubscription,
  listCoachPlans,
  listCoachSubscriptionsForAdmin,
  updateCoachPlan,
} from "../services/CoachSubscriptionService";
import { CoachPlanBillingCycle } from "../models/CoachPlan";

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return undefined;
};

const normalizeBillingCycle = (value: unknown): CoachPlanBillingCycle => {
  if (value === "YEARLY") {
    return "YEARLY";
  }

  return "MONTHLY";
};

// Override requests deprecated — helper removed

export const listCoachPlansHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const plans = await listCoachPlans({ isActive: true });

    res.status(200).json({
      success: true,
      message: "Coach subscription plans retrieved successfully",
      data: {
        plans,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve coach subscription plans",
    });
  }
};

export const getMyCoachSubscriptionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const subscription = await getMyCoachSubscription(req.user.id);

    res.status(200).json({
      success: true,
      message: "Coach subscription retrieved successfully",
      data: {
        subscription,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve subscription";
    const statusCode = message.includes("not found") ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

export const createOrUpdateMyCoachSubscriptionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }
    // Deprecated: coach-level create/update subscription handled via coach packages
    res.status(410).json({
      success: false,
      message:
        "Deprecated endpoint. Use /coaches/subscriptions to subscribe to coach packages.",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update coach subscription",
    });
  }
};

export const cancelMyCoachSubscriptionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !req.user.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const bodySubscriptionId =
      typeof req.body?.subscriptionId === "string"
        ? req.body.subscriptionId
        : undefined;

    if (bodySubscriptionId) {
      const cancelled = await cancelCoachSubscriptionByUser({
        subscriptionId: bodySubscriptionId,
        reason:
          typeof req.body?.reason === "string" ? req.body.reason : undefined,
        userId: req.user.id,
        userRole: req.user.role,
      });

      res.status(200).json({
        success: true,
        message: "Coach subscription cancelled successfully",
        data: {
          subscription: cancelled,
        },
      });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(400).json({
        success: false,
        message:
          "subscriptionId is required for non-coach accounts on this endpoint",
      });
      return;
    }

    // Find coach profile
    const coach = await (
      await import("../models/Coach")
    ).Coach.findOne({
      userId: req.user.id,
    }).select("_id");

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    // Find active subscription for this coach
    const sub = await (
      await import("../models/CoachSubscription")
    ).CoachSubscription.findOne({
      coachId: coach._id,
      status: { $in: ["ACTIVE", "PAST_DUE"] },
    }).sort({ createdAt: -1 });

    if (!sub) {
      res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
      return;
    }

    const cancelled = await cancelCoachSubscriptionByUser({
      subscriptionId: sub._id.toString(),
      reason:
        typeof req.body?.reason === "string" ? req.body.reason : undefined,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: "Coach subscription cancelled successfully",
      data: {
        subscription: cancelled,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel coach subscription",
    });
  }
};

export const listCoachPlansAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const isActive = parseBoolean(req.query.isActive);
    const plans = await listCoachPlans(
      typeof isActive === "boolean" ? { isActive } : undefined,
    );

    res.status(200).json({
      success: true,
      message: "Coach plans retrieved successfully",
      data: {
        plans,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve coach plans",
    });
  }
};

export const createCoachPlanAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      code,
      name,
      description,
      pricing,
      features,
      isActive,
      supportsOverrides,
    } = req.body;

    if (!code || !name || !pricing || typeof pricing !== "object") {
      res.status(400).json({
        success: false,
        message: "code, name and pricing are required",
      });
      return;
    }

    const plan = await createCoachPlan({
      code,
      name,
      description,
      pricing,
      features: Array.isArray(features) ? features : [],
      isActive,
      supportsOverrides,
    });

    res.status(201).json({
      success: true,
      message: "Coach plan created successfully",
      data: {
        plan,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create coach plan",
    });
  }
};

export const updateCoachPlanAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const planIdParam = req.params.planId;
    if (typeof planIdParam !== "string" || !planIdParam) {
      res.status(400).json({
        success: false,
        message: "planId is required",
      });
      return;
    }

    const plan = await updateCoachPlan(planIdParam, req.body || {});

    if (!plan) {
      res.status(404).json({
        success: false,
        message: "Coach plan not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Coach plan updated successfully",
      data: {
        plan,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update coach plan",
    });
  }
};

export const listCoachSubscriptionsAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, planId, page, limit } = req.query;

    const query: {
      status?: string;
      planId?: string;
      page?: number;
      limit?: number;
    } = {};

    if (typeof status === "string") {
      query.status = status;
    }
    if (typeof planId === "string") {
      query.planId = planId;
    }
    if (typeof page === "string") {
      query.page = Number(page);
    }
    if (typeof limit === "string") {
      query.limit = Number(limit);
    }

    const data = await listCoachSubscriptionsForAdmin(query);

    res.status(200).json({
      success: true,
      message: "Coach subscriptions retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve coach subscriptions",
    });
  }
};

// Override admin handlers deprecated
