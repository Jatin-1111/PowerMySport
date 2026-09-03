import mongoose from "mongoose";
import { initiatePhonePePayment } from "../../shared/services/PhonePeService";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import { CoachSubscriptionPaymentTransaction } from "../models/CoachSubscriptionPayment";
import { User } from "../models/User";
import { SUBSCRIPTION_TAX_RATE } from "./PricingRates";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachCheckout");

/**
 * Starting a coach-subscription payment.
 *
 * Extracted from `initiateCoachSubscriptionPaymentHandler`, which was the only
 * implementation, so that enrolling in a recurring programme goes through the
 * SAME payment path rather than a second copy of it. Two payment flows for the
 * same product is how fee rates, order-id formats and reconciliation quietly
 * diverge — and reconciliation is the part that decides whether someone who paid
 * actually gets what they bought.
 *
 * The only difference a programme enrolment makes is that the transaction
 * carries `offeringId`/`enrollmentId`, which activation reads to also turn the
 * pending enrolment live.
 */

const PLATFORM_FEE_RATE = Number(
  process.env.SUBSCRIPTION_PLATFORM_FEE_RATE ?? process.env.SERVICE_FEE_RATE ?? 0
);

/** Minimum PhonePe will accept. */
const MIN_CHARGEABLE_PAISE = 100;

export interface SubscriptionAmounts {
  baseAmount: number;
  platformFee: number;
  taxAmount: number;
  total: number;
}

/** Everything in paise, matching the storage convention across the codebase. */
export const computeSubscriptionAmounts = (packagePricePaise: number): SubscriptionAmounts => {
  const baseAmount = Math.round(Number(packagePricePaise) || 0);
  const feeRate = Number.isFinite(PLATFORM_FEE_RATE) ? Math.max(0, PLATFORM_FEE_RATE) : 0;
  const taxRate = Number.isFinite(SUBSCRIPTION_TAX_RATE) ? Math.max(0, SUBSCRIPTION_TAX_RATE) : 0;

  const platformFee = Math.round(baseAmount * feeRate);
  const taxAmount = platformFee > 0 ? Math.round(platformFee * taxRate) : 0;

  return {
    baseAmount,
    platformFee,
    taxAmount,
    total: baseAmount + platformFee + taxAmount,
  };
};

export const buildSubscriptionMerchantOrderId = (params: {
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

export interface InitiateCheckoutPayload {
  userId: string;
  coachId: string;
  packageId: string;
  dependentId?: string | undefined;
  /** Set when this payment buys a place in a recurring programme. */
  offeringId?: mongoose.Types.ObjectId | undefined;
  enrollmentId?: mongoose.Types.ObjectId | undefined;
  /** `type` on the /payment redirect, so the client knows what it just bought. */
  redirectType?: "subscription" | "programme";
}

export interface InitiateCheckoutResult {
  redirectUrl: string;
  merchantOrderId: string;
  state?: string;
  amountBreakdown: SubscriptionAmounts;
  transactionId: mongoose.Types.ObjectId;
}

/**
 * Create the payment transaction and hand back a PhonePe redirect.
 *
 * Throws on validation problems; the caller maps them to a status code. A
 * transaction that fails at the gateway is marked FAILED before rethrowing, so
 * the record never sits PENDING forever.
 */
export const initiateSubscriptionCheckout = async (
  payload: InitiateCheckoutPayload
): Promise<InitiateCheckoutResult> => {
  const packageDoc = await CoachSubscriptionPackage.findById(payload.packageId);
  if (!packageDoc) throw new Error("Subscription package not found");
  if (packageDoc.coachId.toString() !== payload.coachId) {
    throw new Error("Selected package does not belong to this coach");
  }
  if (!packageDoc.isActive) {
    throw new Error("Selected package is not currently available");
  }

  const amounts = computeSubscriptionAmounts(packageDoc.price);
  if (amounts.total < MIN_CHARGEABLE_PAISE) {
    throw new Error("Subscription amount must be at least 1 INR");
  }

  const merchantOrderId = buildSubscriptionMerchantOrderId({
    coachId: payload.coachId,
    packageId: payload.packageId,
    userId: payload.userId,
  });

  const redirectBase =
    process.env.FRONTEND_URL || process.env.PHONEPE_REDIRECT_URL_BASE || "http://localhost:3000";
  const redirectUrl = new URL("/payment", redirectBase);
  redirectUrl.searchParams.set("status", "pending");
  redirectUrl.searchParams.set("type", payload.redirectType ?? "subscription");
  redirectUrl.searchParams.set("coachId", payload.coachId);
  redirectUrl.searchParams.set("packageId", payload.packageId);
  redirectUrl.searchParams.set("merchantOrderId", merchantOrderId);
  if (payload.offeringId) {
    redirectUrl.searchParams.set("offeringId", payload.offeringId.toString());
  }

  const payer = await User.findById(payload.userId).select("phone");

  const paymentPayload: {
    merchantOrderId: string;
    amount: number;
    redirectUrl: string;
    userPhone?: string;
    metaInfo?: Record<string, string>;
  } = {
    merchantOrderId,
    amount: amounts.total,
    redirectUrl: redirectUrl.toString(),
    metaInfo: {
      udf1: payload.coachId,
      udf2: payload.packageId,
      udf3: payload.userId,
      udf4: payload.dependentId || "",
    },
  };

  if (payer?.phone) paymentPayload.userPhone = payer.phone;

  const transaction = await CoachSubscriptionPaymentTransaction.create({
    coachId: packageDoc.coachId,
    userId: payload.userId,
    ...(payload.dependentId ? { dependentId: payload.dependentId } : {}),
    packageId: packageDoc._id,
    ...(payload.offeringId ? { offeringId: payload.offeringId } : {}),
    ...(payload.enrollmentId ? { enrollmentId: payload.enrollmentId } : {}),
    merchantOrderId,
    baseAmount: amounts.baseAmount,
    platformFeeAmount: amounts.platformFee,
    taxAmount: amounts.taxAmount,
    amount: amounts.total,
    status: "PENDING",
    state: "PENDING",
    redirectUrl: redirectUrl.toString(),
  });

  try {
    const initResult = await initiatePhonePePayment(paymentPayload);

    if (initResult.orderId) transaction.phonepeOrderId = initResult.orderId;
    transaction.redirectUrl = initResult.redirectUrl;
    transaction.state = initResult.state || "PENDING";
    await transaction.save();

    return {
      redirectUrl: initResult.redirectUrl,
      merchantOrderId,
      ...(initResult.state ? { state: initResult.state } : {}),
      amountBreakdown: amounts,
      transactionId: transaction._id as mongoose.Types.ObjectId,
    };
  } catch (error) {
    // Never leave the record PENDING after the gateway refused it.
    if (transaction.status === "PENDING") {
      transaction.status = "FAILED";
      transaction.state = "FAILED";
      await transaction.save().catch(() => undefined);
    }
    log.error("initiateSubscriptionCheckout failed:", error);
    throw error;
  }
};
