import { Request, Response } from "express";
import {
  createCoachSubscriptionPackage,
  getCoachSubscriptionPackages,
  getCoachSubscriptionPackageById,
  updateCoachSubscriptionPackage,
  deleteCoachSubscriptionPackage,
  getCoachAllPackagesByFrequency,
  validateCoachOwnsPackage,
} from "../services/CoachSubscriptionPackageService";
import {
  subscribeToCoachPackage,
  getUserCoachSubscriptions,
  cancelCoachSubscriptionByUser,
  getCoachActiveSubscriptions,
  getCoachSubscriptionRevenue,
} from "../services/CoachSubscriptionService";
import { Coach } from "../models/Coach";
import { getPhonePeOrderStatus, isPhonePeGatewayError } from "../../shared/services/PhonePeService";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { User } from "../models/User";
import { CoachSubscriptionPaymentTransaction } from "../models/CoachSubscriptionPayment";
import { CoachSubscription } from "../models/CoachSubscription";
import { reconcileCoachSubscriptionPaymentByIdentifiers } from "../services/CoachSubscriptionPaymentService";
import { initiateSubscriptionCheckout } from "../services/CoachSubscriptionCheckoutService";
import { computeSubscriptionFees } from "../services/PricingRates";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// Fee rates and the merchant-order-id format now live in
// CoachSubscriptionCheckoutService, which owns every subscription payment.

/**
 * Create a new subscription package (Coach endpoint)
 */
export const createCoachPackageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const { name, description, frequency, price, features, maxStudents, maxSessions } = req.body;

    if (!name || !frequency || price === undefined) {
      throw new AppError("Missing required fields: name, frequency, price", 400);
    }

    const package_ = await createCoachSubscriptionPackage({
      coachId: coach._id.toString(),
      name,
      description,
      frequency,
      price,
      features: features || [],
      maxStudents: maxStudents || null,
      maxSessions: maxSessions || null,
    });

    res.status(201).json({
      success: true,
      message: "Subscription package created successfully",
      data: {
        package: package_,
      },
    });
  }
);

/**
 * Get coach's subscription packages
 */
export const getCoachPackagesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const packages = await getCoachSubscriptionPackages(coach._id.toString());

    res.status(200).json({
      success: true,
      message: "Coach subscription packages retrieved successfully",
      data: {
        packages,
      },
    });
  }
);

/**
 * Get coach's packages by another user (public view)
 */
export const getCoachPublicPackagesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rawCoachId = req.params.coachId;
    const coachId = Array.isArray(rawCoachId) ? rawCoachId[0] : rawCoachId;

    if (typeof coachId !== "string" || !coachId) {
      throw new AppError("Coach ID is required", 400);
    }

    const packages = await getCoachSubscriptionPackages(coachId, {
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Coach packages retrieved successfully",
      data: {
        packages,
      },
    });
  }
);

/**
 * Update a subscription package (Coach endpoint)
 */
export const updateCoachPackageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const rawPackageId = req.params.packageId;
    const packageId = Array.isArray(rawPackageId) ? rawPackageId[0] : rawPackageId;

    if (typeof packageId !== "string" || !packageId) {
      throw new AppError("packageId is required", 400);
    }

    // Verify ownership
    const isOwner = await validateCoachOwnsPackage(coach._id.toString(), packageId);
    if (!isOwner) {
      throw new AppError("You do not own this package", 403);
    }

    const updatedPackage = await updateCoachSubscriptionPackage(packageId, req.body);

    if (!updatedPackage) {
      throw new AppError("Package not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: {
        package: updatedPackage,
      },
    });
  }
);

/**
 * Delete a subscription package (Coach endpoint)
 */
export const deleteCoachPackageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const rawPackageId = req.params.packageId;
    const packageId = Array.isArray(rawPackageId) ? rawPackageId[0] : rawPackageId;

    if (typeof packageId !== "string" || !packageId) {
      throw new AppError("packageId is required", 400);
    }

    // Verify ownership
    const isOwner = await validateCoachOwnsPackage(coach._id.toString(), packageId);
    if (!isOwner) {
      throw new AppError("You do not own this package", 403);
    }

    const deleted = await deleteCoachSubscriptionPackage(packageId);

    if (!deleted) {
      throw new AppError("Package not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Package deleted successfully",
    });
  }
);

/**
 * Subscribe user to a coach's package
 */
/**
 * The authoritative subscription price breakdown, in paise.
 *
 * The client used to recompute this from `NEXT_PUBLIC_SUBSCRIPTION_*` rate
 * copies. Same problem as the booking quote: two independently-configured
 * sources for the number shown versus the number charged.
 */
export const getSubscriptionQuoteHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { basePaise } = req.body as { basePaise: number };

    if (!Number.isFinite(basePaise) || basePaise < 0) {
      throw new AppError("A non-negative basePaise amount is required", 400);
    }

    const fees = computeSubscriptionFees(Math.round(basePaise));

    res.status(200).json({
      success: true,
      data: {
        basePaise: fees.subtotal,
        platformFeePaise: fees.serviceFee,
        taxPaise: fees.tax,
        totalPaise: fees.total,
      },
    });
  }
);

export const subscribeToCoachPackageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const { coachId, packageId, merchantOrderId } = req.body as {
      coachId?: string;
      packageId?: string;
      merchantOrderId?: string;
    };

    if (
      typeof coachId !== "string" ||
      typeof packageId !== "string" ||
      typeof merchantOrderId !== "string"
    ) {
      throw new AppError("Coach ID, Package ID and merchantOrderId are required", 400);
    }

    const transaction = await CoachSubscriptionPaymentTransaction.findOne({
      merchantOrderId,
    });

    if (!transaction) {
      throw new AppError("Payment transaction not found", 404);
    }

    if (transaction.userId.toString() !== req.user.id) {
      throw new AppError("You are not authorized to use this payment", 403);
    }

    if (
      transaction.coachId.toString() !== coachId ||
      transaction.packageId.toString() !== packageId
    ) {
      throw new AppError("Payment does not match the selected coach/package", 400);
    }

    if (transaction.status !== "COMPLETED") {
      throw new AppError(
        "Payment is not verified yet. Subscription will activate after webhook confirmation.",
        409
      );
    }

    if (transaction.linkedSubscriptionId) {
      const existing = await CoachSubscription.findById(transaction.linkedSubscriptionId)
        .populate("packageId")
        .populate("coachId", "bio sports rating reviewCount");

      if (existing) {
        res.status(200).json({
          success: true,
          message: "Subscription already active",
          data: {
            subscription: existing,
          },
        });
        return;
      }
    }

    const subscription = await subscribeToCoachPackage({
      userId: req.user.id,
      coachId,
      packageId,
    });

    transaction.linkedSubscriptionId = subscription._id;
    await transaction.save();

    res.status(201).json({
      success: true,
      message: "Subscription activated successfully",
      data: {
        subscription,
      },
    });
  }
);

/**
 * Get user's subscriptions to a coach
 */
export const getUserCoachSubscriptionsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const rawCoachId = req.query.coachId;
    const coachId = Array.isArray(rawCoachId) ? rawCoachId[0] : rawCoachId;

    const query: { userId: string; coachId?: string } = { userId: req.user.id };
    if (typeof coachId === "string") {
      query.coachId = coachId;
    }

    const subscriptions = await getUserCoachSubscriptions(query);
    const normalizedSubscriptions = Array.isArray(subscriptions)
      ? subscriptions
      : subscriptions
        ? [subscriptions]
        : [];

    res.status(200).json({
      success: true,
      message: "User subscriptions retrieved successfully",
      data: {
        subscriptions: normalizedSubscriptions,
      },
    });
  }
);

/**
 * Cancel a subscription
 */
export const cancelSubscriptionHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const rawSubscriptionId = req.params.subscriptionId;
    const subscriptionId = Array.isArray(rawSubscriptionId)
      ? rawSubscriptionId[0]
      : rawSubscriptionId;
    const { reason } = req.body;

    if (typeof subscriptionId !== "string" || !subscriptionId) {
      throw new AppError("subscriptionId is required", 400);
    }

    const subscription = await cancelCoachSubscriptionByUser({
      subscriptionId,
      reason,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: {
        subscription,
      },
    });
  }
);

/**
 * Get coach's active subscriptions (Coach endpoint)
 */
export const getCoachActiveSubscriptionsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const subscriptions = await getCoachActiveSubscriptions(coach._id.toString());

    res.status(200).json({
      success: true,
      message: "Coach active subscriptions retrieved successfully",
      data: {
        subscriptions,
      },
    });
  }
);

/**
 * Get coach's subscription revenue (Coach endpoint)
 */
export const getCoachSubscriptionRevenueHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const revenue = await getCoachSubscriptionRevenue({
      coachId: coach._id.toString(),
    });

    res.status(200).json({
      success: true,
      message: "Coach subscription revenue retrieved successfully",
      data: {
        revenue,
      },
    });
  }
);

/**
 * Initiate PhonePe payment for a coach subscription package
 * POST /api/coaches/subscriptions/phonepe/initiate
 *
 * NOTE: this handler keeps its own try/catch. The catch block does not simply
 * log-and-respond a generic message — it classifies PhonePe gateway errors
 * (via isPhonePeGatewayError) to surface their specific statusCode plus a
 * machine-readable `code`/`retryable` payload that the client depends on.
 * Collapsing this into a thrown AppError would silently drop that payload for
 * every gateway failure, so the explicit handling is preserved as-is.
 */
export const initiateCoachSubscriptionPaymentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError("Authentication required", 401);
      }

      if (req.user.role !== "Player" && req.user.role !== "Parent") {
        throw new AppError("Only player and parent accounts can purchase subscriptions", 403);
      }

      const { coachId, packageId, dependentId } = req.body as {
        coachId?: string;
        packageId?: string;
        dependentId?: string;
      };

      if (typeof coachId !== "string" || typeof packageId !== "string") {
        throw new AppError("Coach ID and Package ID are required", 400);
      }

      const packageDoc = await CoachSubscriptionPackage.findById(packageId).lean();
      if (!packageDoc) {
        throw new AppError("Subscription package not found", 404);
      }

      if (packageDoc.coachId.toString() !== coachId) {
        throw new AppError("Selected package does not belong to this coach", 400);
      }

      if (!packageDoc.isActive) {
        throw new AppError("Selected package is not currently available", 400);
      }

      const result = await initiateSubscriptionCheckout({
        userId: req.user.id,
        coachId,
        packageId,
        ...(dependentId ? { dependentId } : {}),
      });

      res.status(200).json({
        success: true,
        message: "Subscription payment initiated",
        data: {
          redirectUrl: result.redirectUrl,
          merchantOrderId: result.merchantOrderId,
          state: result.state,
          amountBreakdown: {
            baseAmount: result.amountBreakdown.baseAmount,
            platformFee: result.amountBreakdown.platformFee,
            taxAmount: result.amountBreakdown.taxAmount,
            total: result.amountBreakdown.total,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // The checkout service marks its own transaction FAILED before rethrowing.
      const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to initiate subscription payment",
        ...(isPhonePeGatewayError(error)
          ? { data: { code: error.code, retryable: error.retryable } }
          : {}),
      });
    }
  }
);

/**
 * Verify PhonePe subscription payment status
 * GET /api/coaches/subscriptions/phonepe/status/:merchantOrderId
 *
 * NOTE: same rationale as above — the catch block classifies PhonePe gateway
 * errors to preserve their statusCode/code/retryable payload, so it is kept
 * rather than collapsed into a thrown AppError.
 */
export const verifyCoachSubscriptionPaymentStatusHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError("Unauthorized", 401);
      }

      const merchantOrderIdParam = Array.isArray(req.params.merchantOrderId)
        ? req.params.merchantOrderId[0]
        : req.params.merchantOrderId;
      if (!merchantOrderIdParam) {
        throw new AppError("merchantOrderId is required", 400);
      }

      const transaction = await CoachSubscriptionPaymentTransaction.findOne({
        merchantOrderId: merchantOrderIdParam,
      });

      if (!transaction) {
        throw new AppError("Subscription payment transaction not found", 404);
      }

      if (transaction.userId.toString() !== req.user.id) {
        throw new AppError("You are not authorized to access this payment", 403);
      }

      const status = await getPhonePeOrderStatus(merchantOrderIdParam);
      transaction.lastStatusPayload = status.raw;
      await transaction.save();

      const reconciled = await reconcileCoachSubscriptionPaymentByIdentifiers({
        merchantOrderId: merchantOrderIdParam,
        state: status.state,
        callbackPayload: status.raw as Record<string, unknown>,
        allowActivation: false,
      });

      const effectiveTransaction = reconciled || transaction;
      const activationPending =
        effectiveTransaction.status === "COMPLETED" && !effectiveTransaction.linkedSubscriptionId;

      res.status(200).json({
        success: true,
        message: "Subscription payment status retrieved",
        data: {
          state: status.state,
          merchantOrderId: merchantOrderIdParam,
          subscriptionId: effectiveTransaction.linkedSubscriptionId || null,
          activationPending,
          amountBreakdown: {
            baseAmount: effectiveTransaction.baseAmount,
            platformFee: effectiveTransaction.platformFeeAmount,
            taxAmount: effectiveTransaction.taxAmount,
            total: effectiveTransaction.amount,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;
      res.status(statusCode).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to verify subscription payment status",
        ...(isPhonePeGatewayError(error)
          ? { data: { code: error.code, retryable: error.retryable } }
          : {}),
      });
    }
  }
);
