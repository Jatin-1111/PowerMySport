/**
 * Refund Service - Handles all refund operations
 * Supports multiple refund methods:
 * 1. Return to original card (PhonePe reversal) - default
 * 2. Bank transfer (manual from admin)
 * 3. Store credit (instant wallet credit)
 */

import { Booking } from "../models/Booking";
import { BookingPaymentTransaction } from "../models/BookingPayment";
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

export type RefundMethod = "ORIGINAL_CARD" | "BANK_TRANSFER" | "STORE_CREDIT";

export interface InitiateRefundPayload {
  bookingPaymentTransactionId: string;
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
  payload: InitiateRefundPayload,
): Promise<RefundStatusResponse> {
  const { bookingPaymentTransactionId, amount, reason, refundMethod = "ORIGINAL_CARD" } = payload;

  // Get the payment transaction
  const transaction = await BookingPaymentTransaction.findById(
    bookingPaymentTransactionId,
  );
  if (!transaction) {
    throw new Error("Payment transaction not found");
  }

  // Validate refund amount (both values are in paise)
  if (amount > transaction.amount) {
    throw new Error(
      `Refund amount (${amount} paise) cannot exceed original payment (${transaction.amount} paise)`,
    );
  }

  // Validate refund not already processed
  if (transaction.refundState && transaction.refundState !== "FAILED") {
    throw new Error(
      `Refund already ${transaction.refundState.toLowerCase()} for this transaction`,
    );
  }

  let refundId: string | undefined;
  let state: string = "INITIATED";

  try {
    switch (refundMethod) {
      case "ORIGINAL_CARD":
        return await initiateCardRefund(transaction, amount);

      case "BANK_TRANSFER":
        if (!payload.bankDetails) {
          throw new Error("Bank details required for bank transfer refunds");
        }
        return await initiateBankTransferRefund(transaction, amount, payload.bankDetails);

      case "STORE_CREDIT":
        return await initiateStoreCreditRefund(transaction, amount);

      default:
        throw new Error(`Unknown refund method: ${refundMethod}`);
    }
  } catch (error) {
    console.error("Error initiating refund:", error);
    throw error;
  }
}

/**
 * Refund via PhonePe to original card (default method)
 */
async function initiateCardRefund(
  transaction: any,
  amount: number,
): Promise<RefundStatusResponse> {
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
    console.error("PhonePe refund initiation failed:", error);
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
  },
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
              <tr><td>Amount</td><td>₹${amount}</td></tr>
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
    console.log(`✅ Finance team notified for bank transfer refund ${bankTransferId}`);
  } catch (emailError) {
    console.error("❌ Failed to send finance team notification:", emailError);
    // Don't throw — refund record was already created
  }

  // Notify the player that their refund is being processed
  try {
    if (transaction.userId) {
      await NotificationService.send({
        userId: transaction.userId.toString(),
        type: "PAYMENT_REFUND",
        title: "Refund Initiated",
        message: `Your refund of ₹${amount} has been initiated via bank transfer and will be processed within 2-3 business days.`,
        data: {
          refundId: bankTransferId,
          amount,
          method: "BANK_TRANSFER",
          transactionId: transaction._id.toString(),
        },
      });
    }
  } catch (notifError) {
    console.error("❌ Failed to send player refund notification:", notifError);
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
  amount: number,
): Promise<RefundStatusResponse> {
  try {
    // Add credit to player's wallet
    const { transaction: walletTx } = await WalletService.creditWallet(
      transaction.userId.toString(),
      amount,
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
    console.error("Store credit refund failed:", error);
    transaction.refundState = "FAILED";
    transaction.refundAmount = amount;
    await transaction.save();
    throw error;
  }
}

/**
 * Check refund status for a payment transaction
 */
export async function checkRefundStatus(
  transactionId: string,
): Promise<RefundStatusResponse> {
  const transaction = await BookingPaymentTransaction.findById(transactionId);

  if (!transaction) {
    throw new Error("Payment transaction not found");
  }

  if (!transaction.refundId) {
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

    if (status.refundId || transaction.refundId) {
      response.refundId = status.refundId || transaction.refundId;
    }

    return response;
  } catch (error) {
    console.error("Error checking refund status:", error);
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
        // Send completion notification
        const user = await User.findById(transaction.userId);
        if (user) {
          await NotificationService.send(
            {
              userId: user._id.toString(),
              type: "PAYMENT_REFUND",
              title: "Refund completed",
              message: `Your refund of ₹${transaction.refundAmount || 0} has been completed.`,
              data: {
                amount: transaction.refundAmount || 0,
                method: "ORIGINAL_CARD",
                transactionId: transaction._id.toString(),
              },
            },
            { sendEmail: true, sendPush: true },
          );
        }
      } else if (status.state === "FAILED") {
        failed++;
      }
    } catch (error) {
      console.error(`Error updating refund ${transaction._id}:`, error);
    }
  }

  return {
    checked: pendingRefunds.length,
    completed,
    failed,
  };
}
