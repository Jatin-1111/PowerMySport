/**
 * Refund Service - Handles all refund operations
 * Supports multiple refund methods:
 * 1. Return to original card (PhonePe reversal) - default
 * 2. Bank transfer (manual from admin)
 * 3. Store credit (instant wallet credit)
 */

import { Booking } from "../models/Booking";
import { BookingPaymentTransaction } from "../models/BookingPayment";
import { CoachSubscriptionPaymentTransaction } from "../models/CoachSubscriptionPayment";
import { User } from "../models/User";
import { WalletService } from "./WalletService";
import {
  initiatePhonePeRefund,
  getPhonePeRefundStatus,
  PhonePeRefundResult,
  PhonePeRefundStatusResult,
} from "../../shared/services/PhonePeService";
import { NotificationService } from "./NotificationService";
import { sendEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("refund");

export type RefundMethod = "ORIGINAL_CARD" | "BANK_TRANSFER" | "STORE_CREDIT";

/**
 * Which collection the payment being refunded lives in.
 *
 * The refund logic below is generic — it only reads `merchantOrderId`/`amount`
 * and writes the `refund*` fields, both of which the two transaction models
 * share by design. Only the LOOKUP differs, so this switches the lookup rather
 * than duplicating a pipeline that moves money.
 *
 * It is an explicit parameter rather than probing both collections by id: an
 * ambiguous resolution in a refund path is not a thing to leave to chance.
 */
export type RefundSource = "BOOKING" | "COACH_SUBSCRIPTION";

const findRefundableTransaction = async (id: string, source: RefundSource): Promise<any | null> =>
  source === "COACH_SUBSCRIPTION"
    ? CoachSubscriptionPaymentTransaction.findById(id)
    : BookingPaymentTransaction.findById(id);

export interface InitiateRefundPayload {
  /** Historical name; holds the id of whichever transaction `source` names. */
  bookingPaymentTransactionId: string;
  /** Defaults to BOOKING so every existing caller keeps working unchanged. */
  source?: RefundSource;
  amount: number;
  reason?: string;
  refundMethod?: RefundMethod; // Defaults to ORIGINAL_CARD
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName?: string;
  };
}

export interface RefundStatusResponse {
  transactionId: string;
  refundId?: string;
  state: string; // INITIATED, COMPLETED, FAILED
  amount: number;
  method: RefundMethod;
  completedAt?: Date;
  failureReason?: string;
}

/**
 * Initiate a refund to a player
 * Creates a refund transaction and initiates based on selected method
 */
export async function initiateRefund(
  payload: InitiateRefundPayload
): Promise<RefundStatusResponse> {
  const {
    bookingPaymentTransactionId,
    amount,
    reason,
    refundMethod = "ORIGINAL_CARD",
    source = "BOOKING",
  } = payload;

  // Get the payment transaction
  const transaction = await findRefundableTransaction(bookingPaymentTransactionId, source);
  if (!transaction) {
    throw new Error("Payment transaction not found");
  }

  // Validate refund amount (both values are in paise)
  if (amount > transaction.amount) {
    throw new Error(
      `Refund amount (${amount} paise) cannot exceed original payment (${transaction.amount} paise)`
    );
  }

  // Reject bad input BEFORE claiming, so a request that was never going to work
  // cannot leave the transaction marked as having a refund in flight.
  if (refundMethod === "BANK_TRANSFER" && !payload.bankDetails) {
    throw new Error("Bank details required for bank transfer refunds");
  }
  if (!["ORIGINAL_CARD", "BANK_TRANSFER", "STORE_CREDIT"].includes(refundMethod)) {
    throw new Error(`Unknown refund method: ${refundMethod}`);
  }

  // A payment made from the wallet was never charged to a card, so there is no
  // card to reverse: the gateway would be asked to refund an order it has never
  // heard of, and fail forever. Money paid from the wallet goes back to it.
  const effectiveMethod: RefundMethod =
    refundMethod === "ORIGINAL_CARD" && isWalletPayment(transaction)
      ? "STORE_CREDIT"
      : refundMethod;

  // Claim the refund atomically BEFORE touching the gateway or the wallet. The
  // old check read `refundState` off a document loaded earlier and acted on it,
  // so two triggers (the expiry job, a cancel, an admin) could each pass it and
  // each send a refund. Now exactly one caller flips the state from "none or
  // FAILED" to INITIATED; every other caller is turned away here. A failed
  // attempt releases the claim by setting FAILED, so it stays retryable.
  const claimed = await claimRefund(source, transaction._id, amount);

  try {
    switch (effectiveMethod) {
      case "ORIGINAL_CARD":
        return await initiateCardRefund(claimed, amount);

      case "BANK_TRANSFER":
        return await initiateBankTransferRefund(claimed, amount, payload.bankDetails!);

      case "STORE_CREDIT":
        return await initiateStoreCreditRefund(claimed, amount);

      default:
        throw new Error(`Unknown refund method: ${effectiveMethod}`);
    }
  } catch (error) {
    log.error("Error initiating refund:", error);
    throw error;
  }
}

const refundModelFor = (source: RefundSource): any =>
  source === "COACH_SUBSCRIPTION" ? CoachSubscriptionPaymentTransaction : BookingPaymentTransaction;

const isWalletPayment = (transaction: any): boolean =>
  typeof transaction?.merchantOrderId === "string" &&
  transaction.merchantOrderId.startsWith("WALLET-");

/** One conditional update: only a transaction with no refund (or a FAILED one) is claimed. */
const claimRefund = async (source: RefundSource, id: unknown, amount: number): Promise<any> => {
  const Model = refundModelFor(source);
  const claimed = await Model.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { refundState: { $exists: false } },
        { refundState: null },
        { refundState: "" },
        { refundState: "FAILED" },
      ],
    },
    { $set: { refundState: "INITIATED", refundAmount: amount } },
    { new: true }
  );

  if (!claimed) {
    const current = await Model.findById(id).select("refundState").lean();
    throw new Error(
      `Refund already ${String(current?.refundState ?? "initiated").toLowerCase()} for this transaction`
    );
  }

  return claimed;
};

/**
 * Refund via PhonePe to original card (default method)
 */
async function initiateCardRefund(transaction: any, amount: number): Promise<RefundStatusResponse> {
  if (!transaction.merchantOrderId) {
    throw new Error("Merchant order ID not found for refund");
  }

  // Generate unique refund merchant ID
  const refundMerchantId = `REFUND-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    // Convert paise → rupees: initiatePhonePeRefund() → buildRefundRequest()
    // does Math.round(amount * 100) internally, expecting rupees as input.
    // BookingPaymentTransaction.amount is stored in paise.
    const refundResult = await initiatePhonePeRefund({
      merchantRefundId: refundMerchantId,
      originalMerchantOrderId: transaction.merchantOrderId,
      amount: amount / 100,
    });

    // Update transaction with refund details
    transaction.refundMerchantId = refundMerchantId;
    transaction.refundId = refundResult.refundId;
    transaction.refundState = refundResult.state || "INITIATED";
    transaction.refundAmount = amount;
    transaction.refundResponse = refundResult.raw;
    await transaction.save();

    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: refundResult.state || "INITIATED",
      amount,
      method: "ORIGINAL_CARD",
    };

    if (refundResult.refundId) {
      response.refundId = refundResult.refundId;
    }

    return response;
  } catch (error) {
    log.error("PhonePe refund initiation failed:", error);
    transaction.refundState = "FAILED";
    transaction.refundAmount = amount;
    await transaction.save();
    throw error;
  }
}

/**
 * Refund via bank transfer (admin-initiated)
 * Stores bank details but requires manual transfer by finance team
 */
async function initiateBankTransferRefund(
  transaction: any,
  amount: number,
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName?: string;
  }
): Promise<RefundStatusResponse> {
  const bankTransferId = `BANK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Store bank transfer details
  transaction.refundMerchantId = bankTransferId;
  transaction.refundState = "INITIATED"; // Awaiting manual transfer
  transaction.refundAmount = amount;
  transaction.refundResponse = {
    method: "BANK_TRANSFER",
    bankDetails,
    initiatedAt: new Date(),
    status: "PENDING_MANUAL_TRANSFER",
  };
  await transaction.save();

  // Send notification to finance team for manual processing
  try {
    await sendEmail({
      to: process.env.EMAIL_FROM || "teams@powermysport.com",
      subject: `[Action Required] Bank Transfer Refund — ${bankTransferId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 20px 30px; border-radius: 10px 10px 0 0; }
            .header h2 { margin: 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            .detail-table td { padding: 8px 12px; border: 1px solid #e5e7eb; }
            .detail-table td:first-child { font-weight: bold; background: #f3f4f6; width: 40%; }
            .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>💳 Manual Bank Transfer Refund Required</h2>
          </div>
          <div class="content">
            <p>A bank transfer refund has been initiated and requires manual processing by the finance team.</p>
            <table class="detail-table">
              <tr><td>Refund ID</td><td>${bankTransferId}</td></tr>
              <tr><td>Amount</td><td>₹${(amount / 100).toLocaleString("en-IN")}</td></tr>
              <tr><td>Transaction ID</td><td>${transaction._id.toString()}</td></tr>
              <tr><td>Account Holder</td><td>${bankDetails.accountHolderName}</td></tr>
              <tr><td>Account Number</td><td>${bankDetails.accountNumber}</td></tr>
              <tr><td>IFSC Code</td><td>${bankDetails.ifscCode}</td></tr>
              ${bankDetails.bankName ? `<tr><td>Bank Name</td><td>${bankDetails.bankName}</td></tr>` : ""}
              <tr><td>Initiated At</td><td>${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td></tr>
            </table>
            <div class="alert">
              ⚠️ Please complete this bank transfer within 2-3 business days and update the refund status in the admin dashboard.
            </div>
          </div>
        </body>
        </html>
      `,
    });
    log.info(`Finance team notified for bank transfer refund ${bankTransferId}`);
  } catch (emailError) {
    log.error("Failed to send finance team notification:", emailError);
    // Don't throw — refund record was already created
  }

  // Notify the player that their refund is being processed
  try {
    if (transaction.userId) {
      await NotificationService.send({
        userId: transaction.userId.toString(),
        type: "PAYMENT_REFUND",
        title: "Refund Initiated",
        message: `Your refund of ₹${(amount / 100).toLocaleString("en-IN")} has been initiated via bank transfer and will be processed within 2-3 business days.`,
        data: {
          refundId: bankTransferId,
          amount,
          method: "BANK_TRANSFER",
          transactionId: transaction._id.toString(),
        },
      });
    }
  } catch (notifError) {
    log.error("Failed to send player refund notification:", notifError);
  }

  return {
    transactionId: transaction._id.toString(),
    refundId: bankTransferId,
    state: "INITIATED",
    amount,
    method: "BANK_TRANSFER",
  };
}

/**
 * Refund via instant store credit to player's wallet
 */
async function initiateStoreCreditRefund(
  transaction: any,
  amount: number
): Promise<RefundStatusResponse> {
  try {
    // amount is in paise; wallet balance is denominated in rupees — convert before crediting
    const amountInRupees = amount / 100;
    const { transaction: walletTx } = await WalletService.creditWallet(
      transaction.userId.toString(),
      amountInRupees,
      "Booking Refund",
      transaction._id.toString()
    );
    const storeCreditId = walletTx.id;

    // Update transaction
    transaction.refundMerchantId = storeCreditId;
    transaction.refundId = storeCreditId;
    transaction.refundState = "COMPLETED";
    transaction.refundAmount = amount;
    transaction.refundResponse = {
      method: "STORE_CREDIT",
      walletCredited: true,
      completedAt: new Date(),
    };
    await transaction.save();

    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: "COMPLETED",
      amount,
      method: "STORE_CREDIT",
      completedAt: new Date(),
    };

    response.refundId = storeCreditId;
    return response;
  } catch (error) {
    log.error("Store credit refund failed:", error);
    transaction.refundState = "FAILED";
    transaction.refundAmount = amount;
    await transaction.save();
    throw error;
  }
}

/**
 * Check refund status for a payment transaction
 */
export async function checkRefundStatus(transactionId: string): Promise<RefundStatusResponse> {
  const transaction = await BookingPaymentTransaction.findById(transactionId);

  if (!transaction) {
    throw new Error("Payment transaction not found");
  }

  // A refund exists if either the gateway refund ID or the merchant-side
  // tracking ID is set. Card refunds may not receive a refundId synchronously.
  if (!transaction.refundId && !transaction.refundMerchantId) {
    throw new Error("No refund found for this transaction");
  }

  // Handle store credit refunds (already completed)
  if (
    transaction.refundResponse?.method === "STORE_CREDIT" &&
    transaction.refundState === "COMPLETED"
  ) {
    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: "COMPLETED",
      amount: transaction.refundAmount || 0,
      method: "STORE_CREDIT",
      completedAt: transaction.refundResponse.completedAt,
    };

    if (transaction.refundId) {
      response.refundId = transaction.refundId;
    }

    return response;
  }

  // Handle bank transfers (manual process)
  if (transaction.refundResponse?.method === "BANK_TRANSFER") {
    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: transaction.refundState || "INITIATED",
      amount: transaction.refundAmount || 0,
      method: "BANK_TRANSFER",
      failureReason: transaction.refundResponse?.failureReason,
    };

    if (transaction.refundId) {
      response.refundId = transaction.refundId;
    }

    return response;
  }

  // For PhonePe refunds, check status with gateway
  if (!transaction.refundMerchantId) {
    throw new Error("No refund merchant ID found");
  }

  try {
    const status = await getPhonePeRefundStatus(transaction.refundMerchantId);

    // Update transaction with latest status
    if (status.state) {
      transaction.refundState = status.state;
    }
    if (status.state === "COMPLETED") {
      transaction.updatedAt = new Date();
    }
    await transaction.save();

    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: status.state || "INITIATED",
      amount: status.amount || transaction.refundAmount || 0,
      method: "ORIGINAL_CARD",
    };

    const refundId = status.refundId || transaction.refundId;
    if (refundId) {
      response.refundId = refundId;
    }

    return response;
  } catch (error) {
    log.error("Error checking refund status:", error);
    const response: RefundStatusResponse = {
      transactionId: transaction._id.toString(),
      state: transaction.refundState || "INITIATED",
      amount: transaction.refundAmount || 0,
      method: "ORIGINAL_CARD",
      failureReason: String(error),
    };

    if (transaction.refundId) {
      response.refundId = transaction.refundId;
    }

    return response;
  }
}

/**
 * What follows a card refund reaching COMPLETED: the parent booking flips to
 * PROCESSED so the admin panel and player UI update, and the payer is told.
 * Shared by the status poller and the refund webhook so the two paths cannot
 * drift: whichever sees COMPLETED first does this, and the other finds the
 * refund already COMPLETED and skips it.
 */
async function onCardRefundCompleted(transaction: any): Promise<void> {
  if (transaction.bookingId) {
    await Booking.updateOne(
      { _id: transaction.bookingId, refundStatus: { $ne: "PROCESSED" } },
      { $set: { refundStatus: "PROCESSED" } }
    ).catch(() => {});
  }

  const user = await User.findById(transaction.userId);
  if (user) {
    await NotificationService.send(
      {
        userId: user._id.toString(),
        type: "PAYMENT_REFUND",
        title: "Refund completed",
        message: `Your refund of ₹${((transaction.refundAmount || 0) / 100).toLocaleString("en-IN")} has been completed.`,
        data: {
          amount: transaction.refundAmount || 0,
          method: "ORIGINAL_CARD",
          transactionId: transaction._id.toString(),
        },
      },
      { sendEmail: true, sendPush: true }
    );
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

/**
 * Apply a PhonePe refund webhook (`pg.refund.completed` / `pg.refund.failed`) to
 * the payment it refunds.
 *
 * The refund is found by the refund ids PhonePe echoes back (our
 * `merchantRefundId`, or the gateway `refundId` stored at initiation). Failing
 * that, by the original order id, but only for a payment whose refund is still
 * in flight (INITIATED/PENDING), since a payment carries at most one refund. States other than
 * COMPLETED/FAILED (accepted, pending) change nothing.
 *
 * Idempotent: a redelivery, or the poller getting there first, finds the refund
 * already in its final state and does nothing. A COMPLETED refund is never walked
 * back by a later FAILED event. A FAILED refund goes back to FAILED, which is the
 * state `claimRefund` accepts, so it stays retryable, and finance is alerted
 * because nothing else will tell them.
 *
 * Returns the transaction acted on, or null when the event matched none.
 */
export async function reconcileRefundFromWebhookPayload(rawPayload: unknown): Promise<any | null> {
  const body = asRecord(rawPayload);
  const sources = [asRecord(body.payload), body, asRecord(body.data)];
  const pick = (key: string) => firstString(...sources.map((source) => source[key]));

  const state = (pick("state") || "").toUpperCase();
  if (state !== "COMPLETED" && state !== "FAILED") return null;

  const merchantRefundId = pick("merchantRefundId");
  const refundId = pick("refundId");
  const originalMerchantOrderId = pick("originalMerchantOrderId");

  const identifiers: Array<Record<string, string>> = [];
  if (merchantRefundId) identifiers.push({ refundMerchantId: merchantRefundId });
  if (refundId) identifiers.push({ refundId });

  let transaction: any = null;
  for (const Model of [BookingPaymentTransaction, CoachSubscriptionPaymentTransaction] as any[]) {
    transaction = identifiers.length ? await Model.findOne({ $or: identifiers }) : null;
    if (!transaction && originalMerchantOrderId) {
      transaction = await Model.findOne({
        merchantOrderId: originalMerchantOrderId,
        // PhonePe answers an initiation with PENDING, which is stored as-is.
        refundState: { $in: ["INITIATED", "PENDING"] },
      });
    }
    if (transaction) break;
  }

  if (!transaction) {
    log.warn(
      `Refund webhook matched no payment (refundId=${refundId}, merchantRefundId=${merchantRefundId}, order=${originalMerchantOrderId})`
    );
    return null;
  }

  if (transaction.refundState === "COMPLETED" || transaction.refundState === state) {
    return transaction;
  }

  transaction.refundState = state;
  if (refundId && !transaction.refundId) transaction.refundId = refundId;
  await transaction.save();

  if (state === "COMPLETED") {
    await onCardRefundCompleted(transaction);
    return transaction;
  }

  const errorCode = pick("errorCode");
  const detailedErrorCode = pick("detailedErrorCode");
  log.error(
    `PhonePe refund FAILED for transaction ${transaction._id} (refundId=${refundId}, errorCode=${errorCode}, detailedErrorCode=${detailedErrorCode})`
  );
  try {
    await sendEmail({
      to: process.env.EMAIL_FROM || "teams@powermysport.com",
      subject: `[Alert] PhonePe refund failed: ${refundId || transaction._id}`,
      html: `<p>PhonePe reported a failed refund. The payment is released for retry from the admin panel.</p>
        <p>Transaction: ${transaction._id}<br>Refund id: ${refundId || "n/a"}<br>Amount: ₹${((transaction.refundAmount || 0) / 100).toLocaleString("en-IN")}<br>Error: ${errorCode || "n/a"} / ${detailedErrorCode || "n/a"}</p>`,
    });
  } catch (emailError) {
    log.error("Failed to send refund-failed alert:", emailError);
  }

  return transaction;
}

/**
 * Bulk check pending refunds and update their status
 * Used by scheduled jobs to poll refund statuses
 */
export async function updatePendingRefundStatuses(): Promise<{
  checked: number;
  completed: number;
  failed: number;
}> {
  const pendingRefunds = await BookingPaymentTransaction.find({
    refundState: "INITIATED",
    $or: [
      { "refundResponse.method": { $ne: "BANK_TRANSFER" } },
      { "refundResponse.method": { $exists: false } },
    ],
  });

  let completed = 0;
  let failed = 0;

  for (const transaction of pendingRefunds) {
    try {
      const status = await checkRefundStatus(transaction._id.toString());

      if (status.state === "COMPLETED") {
        completed++;
        await onCardRefundCompleted(transaction);
      } else if (status.state === "FAILED") {
        failed++;
      }
    } catch (error) {
      log.error(`Error updating refund ${transaction._id}:`, error);
    }
  }

  return {
    checked: pendingRefunds.length,
    completed,
    failed,
  };
}
