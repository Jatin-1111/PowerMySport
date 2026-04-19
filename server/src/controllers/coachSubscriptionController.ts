import { Request, Response } from "express";
import {
  cancelCoachSubscriptionByUser,
  createCoachPlan,
  createCoachSubscriptionOverrideRequest,
  createOrUpdateCoachSubscription,
  getMyCoachSubscription,
  listOverrideRequestsForCoach,
  listCoachPlans,
  listCoachSubscriptionsForAdmin,
  listOverrideRequestsForAdmin,
  reviewOverrideRequest,
  updateCoachPlan,
} from "../services/CoachSubscriptionService";
import { CoachPlanBillingCycle } from "../models/CoachPlan";
import { CoachSubscriptionOverrideStatus } from "../models/CoachSubscriptionOverrideRequest";

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

const isOverrideStatus = (
  value: unknown,
): value is CoachSubscriptionOverrideStatus => {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
};

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

    const { planId, billingCycle } = req.body;

    if (!planId || typeof planId !== "string") {
      res.status(400).json({
        success: false,
        message: "planId is required",
      });
      return;
    }

    const subscription = await createOrUpdateCoachSubscription({
      userId: req.user.id,
      planId,
      billingCycle: normalizeBillingCycle(billingCycle),
    });

    res.status(201).json({
      success: true,
      message: "Coach subscription updated successfully",
      data: {
        subscription,
      },
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
    if (!req.user?.id || req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const subscription = await cancelCoachSubscriptionByUser({
      userId: req.user.id,
      reason:
        typeof req.body?.reason === "string" ? req.body.reason : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Coach subscription cancelled successfully",
      data: {
        subscription,
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

export const createOverrideRequestHandler = async (
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

    const { requestedPlanId, note } = req.body;
    if (!note || typeof note !== "string" || !note.trim()) {
      res.status(400).json({
        success: false,
        message: "note is required",
      });
      return;
    }

    const payload: {
      userId: string;
      requestedPlanId?: string;
      note: string;
    } = {
      userId: req.user.id,
      note,
    };

    if (typeof requestedPlanId === "string") {
      payload.requestedPlanId = requestedPlanId;
    }

    const request = await createCoachSubscriptionOverrideRequest(payload);

    res.status(201).json({
      success: true,
      message: "Override request submitted successfully",
      data: {
        request,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit override request",
    });
  }
};

export const listMyOverrideRequestsHandler = async (
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

    const { status, page, limit } = req.query;

    const query: {
      userId: string;
      status?: CoachSubscriptionOverrideStatus;
      page?: number;
      limit?: number;
    } = {
      userId: req.user.id,
    };

    if (isOverrideStatus(status)) {
      query.status = status;
    }
    if (typeof page === "string") {
      query.page = Number(page);
    }
    if (typeof limit === "string") {
      query.limit = Number(limit);
    }

    const data = await listOverrideRequestsForCoach(query);

    res.status(200).json({
      success: true,
      message: "Coach override requests retrieved successfully",
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve override requests";
    const statusCode = message.includes("not found") ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message,
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

export const listOverrideRequestsAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, page, limit } = req.query;

    const query: {
      status?: CoachSubscriptionOverrideStatus;
      page?: number;
      limit?: number;
    } = {};

    if (isOverrideStatus(status)) {
      query.status = status;
    }
    if (typeof page === "string") {
      query.page = Number(page);
    }
    if (typeof limit === "string") {
      query.limit = Number(limit);
    }

    const data = await listOverrideRequestsForAdmin(query);

    res.status(200).json({
      success: true,
      message: "Coach override requests retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve override requests",
    });
  }
};

export const reviewOverrideRequestAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const requestIdParam = req.params.requestId;
    if (typeof requestIdParam !== "string" || !requestIdParam) {
      res.status(400).json({
        success: false,
        message: "requestId is required",
      });
      return;
    }

    const { status, reviewNote } = req.body || {};

    if (status !== "APPROVED" && status !== "REJECTED") {
      res.status(400).json({
        success: false,
        message: "status must be APPROVED or REJECTED",
      });
      return;
    }

    const request = await reviewOverrideRequest({
      requestId: requestIdParam,
      reviewerId: req.user.id,
      status,
      reviewNote,
    });

    res.status(200).json({
      success: true,
      message: "Override request reviewed successfully",
      data: {
        request,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to review override request",
    });
  }
};
