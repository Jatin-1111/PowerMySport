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
import {
  getPhonePeOrderStatus,
  initiatePhonePePayment,
  isPhonePeGatewayError,
} from "../../shared/services/PhonePeService";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { User } from "../models/User";
import { CoachSubscriptionPaymentTransaction } from "../models/CoachSubscriptionPayment";
import { CoachSubscription } from "../models/CoachSubscription";
import { reconcileCoachSubscriptionPaymentByIdentifiers } from "../services/CoachSubscriptionPaymentService";

const SUBSCRIPTION_PLATFORM_FEE_RATE = Number(
  process.env.SUBSCRIPTION_PLATFORM_FEE_RATE ??
    process.env.SERVICE_FEE_RATE ??
    0,
);
const SUBSCRIPTION_TAX_RATE = Number(
  process.env.SUBSCRIPTION_TAX_RATE ?? process.env.TAX_RATE ?? 0.05,
);

const buildSubscriptionMerchantOrderId = (params: {
  coachId: string;
  packageId: string;
  userId: string;
}): string => {
  const ts = Date.now().toString(36);
  const coachPart = params.coachId.slice(-6);
  const packagePart = params.packageId.slice(-6);
  const userPart = params.userId.slice(-6);
  const rand = Math.random().toString(36).slice(2, 8);

  // Keep well below PhonePe's 63 char max while preserving traceability.
  return `sub_${ts}_${coachPart}_${packagePart}_${userPart}_${rand}`;
};

/**
 * Create a new subscription package (Coach endpoint)
 */
export const createCoachPackageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const {
      name,
      description,
      frequency,
      price,
      features,
      maxStudents,
      maxSessions,
    } = req.body;

    if (!name || !frequency || price === undefined) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: name, frequency, price",
      });
      return;
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create package";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Get coach's subscription packages
 */
export const getCoachPackagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const packages = await getCoachSubscriptionPackages(coach._id.toString());

    res.status(200).json({
      success: true,
      message: "Coach subscription packages retrieved successfully",
      data: {
        packages,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve packages";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Get coach's packages by another user (public view)
 */
export const getCoachPublicPackagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rawCoachId = req.params.coachId;
    const coachId = Array.isArray(rawCoachId) ? rawCoachId[0] : rawCoachId;

    if (typeof coachId !== "string" || !coachId) {
      res.status(400).json({
        success: false,
        message: "Coach ID is required",
      });
      return;
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve packages";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Update a subscription package (Coach endpoint)
 */
export const updateCoachPackageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const rawPackageId = req.params.packageId;
    const packageId = Array.isArray(rawPackageId)
      ? rawPackageId[0]
      : rawPackageId;

    if (typeof packageId !== "string" || !packageId) {
      res.status(400).json({
        success: false,
        message: "packageId is required",
      });
      return;
    }

    // Verify ownership
    const isOwner = await validateCoachOwnsPackage(
      coach._id.toString(),
      packageId,
    );
    if (!isOwner) {
      res.status(403).json({
        success: false,
        message: "You do not own this package",
      });
      return;
    }

    const updatedPackage = await updateCoachSubscriptionPackage(
      packageId,
      req.body,
    );

    if (!updatedPackage) {
      res.status(404).json({
        success: false,
        message: "Package not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: {
        package: updatedPackage,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update package";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Delete a subscription package (Coach endpoint)
 */
export const deleteCoachPackageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const rawPackageId = req.params.packageId;
    const packageId = Array.isArray(rawPackageId)
      ? rawPackageId[0]
      : rawPackageId;

    if (typeof packageId !== "string" || !packageId) {
      res.status(400).json({
        success: false,
        message: "packageId is required",
      });
      return;
    }

    // Verify ownership
    const isOwner = await validateCoachOwnsPackage(
      coach._id.toString(),
      packageId,
    );
    if (!isOwner) {
      res.status(403).json({
        success: false,
        message: "You do not own this package",
      });
      return;
    }

    const deleted = await deleteCoachSubscriptionPackage(packageId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Package not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete package";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Subscribe user to a coach's package
 */
export const subscribeToCoachPackageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
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
      res.status(400).json({
        success: false,
        message: "Coach ID, Package ID and merchantOrderId are required",
      });
      return;
    }

    const transaction = await CoachSubscriptionPaymentTransaction.findOne({
      merchantOrderId,
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Payment transaction not found",
      });
      return;
    }

    if (transaction.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to use this payment",
      });
      return;
    }

    if (
      transaction.coachId.toString() !== coachId ||
      transaction.packageId.toString() !== packageId
    ) {
      res.status(400).json({
        success: false,
        message: "Payment does not match the selected coach/package",
      });
      return;
    }

    if (transaction.status !== "COMPLETED") {
      res.status(409).json({
        success: false,
        message:
          "Payment is not verified yet. Subscription will activate after webhook confirmation.",
      });
      return;
    }

    if (transaction.linkedSubscriptionId) {
      const existing = await CoachSubscription.findById(
        transaction.linkedSubscriptionId,
      )
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Get user's subscriptions to a coach
 */
export const getUserCoachSubscriptionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
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
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve subscriptions";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Cancel a subscription
 */
export const cancelSubscriptionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const rawSubscriptionId = req.params.subscriptionId;
    const subscriptionId = Array.isArray(rawSubscriptionId)
      ? rawSubscriptionId[0]
      : rawSubscriptionId;
    const { reason } = req.body;

    if (typeof subscriptionId !== "string" || !subscriptionId) {
      res
        .status(400)
        .json({ success: false, message: "subscriptionId is required" });
      return;
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel subscription";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Get coach's active subscriptions (Coach endpoint)
 */
export const getCoachActiveSubscriptionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const subscriptions = await getCoachActiveSubscriptions(
      coach._id.toString(),
    );

    res.status(200).json({
      success: true,
      message: "Coach active subscriptions retrieved successfully",
      data: {
        subscriptions,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve subscriptions";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Get coach's subscription revenue (Coach endpoint)
 */
export const getCoachSubscriptionRevenueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "Coach") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id });
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve revenue";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * Initiate PhonePe payment for a coach subscription package
 * POST /api/coaches/subscriptions/phonepe/initiate
 */
export const initiateCoachSubscriptionPaymentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  let transaction: any = null;

  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (req.user.role !== "Player" && req.user.role !== "Parent") {
      res.status(403).json({
        success: false,
        message: "Only player and parent accounts can purchase subscriptions",
      });
      return;
    }

    const { coachId, packageId, dependentId } = req.body as {
      coachId?: string;
      packageId?: string;
      dependentId?: string;
    };

    if (typeof coachId !== "string" || typeof packageId !== "string") {
      res.status(400).json({
        success: false,
        message: "Coach ID and Package ID are required",
      });
      return;
    }

    const packageDoc =
      await CoachSubscriptionPackage.findById(packageId).lean();
    if (!packageDoc) {
      res.status(404).json({
        success: false,
        message: "Subscription package not found",
      });
      return;
    }

    if (packageDoc.coachId.toString() !== coachId) {
      res.status(400).json({
        success: false,
        message: "Selected package does not belong to this coach",
      });
      return;
    }

    if (!packageDoc.isActive) {
      res.status(400).json({
        success: false,
        message: "Selected package is not currently available",
      });
      return;
    }

    const baseAmountInPaise = Math.round(Number(packageDoc.price) || 0);
    const safePlatformFeeRate = Number.isFinite(SUBSCRIPTION_PLATFORM_FEE_RATE)
      ? Math.max(0, SUBSCRIPTION_PLATFORM_FEE_RATE)
      : 0;
    const safeTaxRate = Number.isFinite(SUBSCRIPTION_TAX_RATE)
      ? Math.max(0, SUBSCRIPTION_TAX_RATE)
      : 0;

    const platformFeeInPaise = Math.round(
      baseAmountInPaise * safePlatformFeeRate,
    );
    const taxAmountInPaise =
      platformFeeInPaise > 0 ? Math.round(platformFeeInPaise * safeTaxRate) : 0;
    const amountInPaise =
      baseAmountInPaise + platformFeeInPaise + taxAmountInPaise;

    if (amountInPaise < 100) {
      res.status(400).json({
        success: false,
        message: "Subscription amount must be at least 1 INR",
      });
      return;
    }

    const merchantOrderId = buildSubscriptionMerchantOrderId({
      coachId,
      packageId,
      userId: req.user.id,
    });
    const redirectBase =
      process.env.FRONTEND_URL ||
      process.env.PHONEPE_REDIRECT_URL_BASE ||
      "http://localhost:3000";
    const redirectUrl = new URL("/payment", redirectBase);
    redirectUrl.searchParams.set("status", "pending");
    redirectUrl.searchParams.set("type", "subscription");
    redirectUrl.searchParams.set("coachId", coachId);
    redirectUrl.searchParams.set("packageId", packageId);
    redirectUrl.searchParams.set("merchantOrderId", merchantOrderId);

    const payer = await User.findById(req.user.id).select("phone");

    const paymentPayload: {
      merchantOrderId: string;
      amount: number;
      redirectUrl: string;
      userPhone?: string;
      metaInfo?: Record<string, string>;
    } = {
      merchantOrderId,
      amount: amountInPaise,
      redirectUrl: redirectUrl.toString(),
      metaInfo: {
        udf1: coachId,
        udf2: packageId,
        udf3: req.user.id,
        udf4: dependentId || "",
      },
    };

    if (payer?.phone) {
      paymentPayload.userPhone = payer.phone;
    }

    transaction = await CoachSubscriptionPaymentTransaction.create({
      coachId: packageDoc.coachId,
      userId: req.user.id,
      ...(dependentId ? { dependentId } : {}),
      packageId: packageDoc._id,
      merchantOrderId,
      baseAmount: baseAmountInPaise,
      platformFeeAmount: platformFeeInPaise,
      taxAmount: taxAmountInPaise,
      amount: amountInPaise,
      status: "PENDING",
      state: "PENDING",
      redirectUrl: redirectUrl.toString(),
    });

    const initResult = await initiatePhonePePayment(paymentPayload);

    if (initResult.orderId) {
      transaction.phonepeOrderId = initResult.orderId;
    }
    transaction.redirectUrl = initResult.redirectUrl;
    transaction.state = initResult.state || "PENDING";
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Subscription payment initiated",
      data: {
        redirectUrl: initResult.redirectUrl,
        merchantOrderId,
        state: initResult.state,
        amountBreakdown: {
          baseAmount: baseAmountInPaise,
          platformFee: platformFeeInPaise,
          taxAmount: taxAmountInPaise,
          total: amountInPaise,
        },
      },
    });
  } catch (error) {
    if (
      typeof transaction !== "undefined" &&
      transaction &&
      transaction.status === "PENDING"
    ) {
      transaction.status = "FAILED";
      transaction.state = "FAILED";
      await transaction.save().catch(() => undefined);
    }

    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;
    res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to initiate subscription payment",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

/**
 * Verify PhonePe subscription payment status
 * GET /api/coaches/subscriptions/phonepe/status/:merchantOrderId
 */
export const verifyCoachSubscriptionPaymentStatusHandler = async (
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

    const merchantOrderIdParam = Array.isArray(req.params.merchantOrderId)
      ? req.params.merchantOrderId[0]
      : req.params.merchantOrderId;
    if (!merchantOrderIdParam) {
      res.status(400).json({
        success: false,
        message: "merchantOrderId is required",
      });
      return;
    }

    const transaction = await CoachSubscriptionPaymentTransaction.findOne({
      merchantOrderId: merchantOrderIdParam,
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Subscription payment transaction not found",
      });
      return;
    }

    if (transaction.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to access this payment",
      });
      return;
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
      effectiveTransaction.status === "COMPLETED" &&
      !effectiveTransaction.linkedSubscriptionId;

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
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;
    res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify subscription payment status",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};
