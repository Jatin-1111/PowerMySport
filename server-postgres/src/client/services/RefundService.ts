/**
 * Refund Service - Handles all refund operations
 * Supports multiple refund methods:
 * 1. Return to original card (PhonePe reversal) - default
 * 2. Bank transfer (manual from admin)
 * 3. Store credit (instant wallet credit)
 */

import { Prisma } from "@prisma/client";
import type { BookingPaymentTransaction } from "@prisma/client";
import prisma from "../../lib/prisma";
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

// Shape stored in the `refundResponse` Json column (method-tagged payload).
type RefundResponseJson = {
  method?: RefundMethod;
  completedAt?: Date;
  failureReason?: string;
} | null;

/**
 * Initiate a refund to a player
 * Creates a refund transaction and initiates based on selected method
 */
export async function initiateRefund(
  payload: InitiateRefundPayload,
): Promise<RefundStatusResponse> {
  const {
    bookingPaymentTransactionId,
    amount,
    reason,
    refundMethod = "ORIGINAL_CARD",
  } = payload;

  // Get the payment transaction
  const transaction = await prisma.bookingPaymentTransaction.findUnique({
    where: { id: bookingPaymentTransactionId },
  });
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
        return await initiateBankTransferRefund(
          transaction,
          amount,
          payload.bankDetails,
        );

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
  transaction: BookingPaymentTransaction,
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
    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        refundMerchantId,
        refundId: refundResult.refundId ?? null,
        refundState: refundResult.state || "INITIATED",
        refundAmount: amount,
        refundResponse: refundResult.raw as Prisma.InputJsonValue,
      },
    });

    const response: RefundStatusResponse = {
      transactionId: transaction.id,
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
    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: { refundState: "FAILED", refundAmount: amount },
    });
    throw error;
  }
}

/**
 * Refund via bank transfer (admin-initiated)
 * Stores bank details but requires manual transfer by finance team
 */
async function initiateBankTransferRefund(
  transaction: BookingPaymentTransaction,
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
  await prisma.bookingPaymentTransaction.update({
    where: { id: transaction.id },
    data: {
      refundMerchantId: bankTransferId,
      refundState: "INITIATED", // Awaiting manual transfer
      refundAmount: amount,
      refundResponse: {
        method: "BANK_TRANSFER",
        bankDetails,
        initiatedAt: new Date().toISOString(),
        status: "PENDING_MANUAL_TRANSFER",
      } as Prisma.InputJsonValue,
    },
  });

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
              <tr><td>Transaction ID</td><td>${transaction.id}</td></tr>
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
    console.log(
      `✅ Finance team notified for bank transfer refund ${bankTransferId}`,
    );
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
        message: `Your refund of ₹${(amount / 100).toLocaleString("en-IN")} has been initiated via bank transfer and will be processed within 2-3 business days.`,
        data: {
          refundId: bankTransferId,
          amount,
          method: "BANK_TRANSFER",
          transactionId: transaction.id,
        },
      });
    }
  } catch (notifError) {
    console.error("❌ Failed to send player refund notification:", notifError);
  }

  return {
    transactionId: transaction.id,
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
  transaction: BookingPaymentTransaction,
  amount: number,
): Promise<RefundStatusResponse> {
  try {
    // amount is in paise; wallet balance is denominated in rupees — convert before crediting
    const amountInRupees = amount / 100;
    // NOTE: WalletService.creditWallet runs its own $transaction (atomic wallet
    // balance increment + WalletTransaction insert). The refund-state write below
    // follows it. TODO(prisma): a fully single-transaction credit+refund-state
    // write would require WalletService.creditWallet to accept an external tx
    // client; kept as service reuse to preserve existing wallet behavior.
    const { transaction: walletTx } = await WalletService.creditWallet(
      transaction.userId.toString(),
      amountInRupees,
      "Booking Refund",
      transaction.id,
    );
    const storeCreditId = walletTx.id;

    // Update transaction
    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        refundMerchantId: storeCreditId,
        refundId: storeCreditId,
        refundState: "COMPLETED",
        refundAmount: amount,
        refundResponse: {
          method: "STORE_CREDIT",
          walletCredited: true,
          completedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    const response: RefundStatusResponse = {
      transactionId: transaction.id,
      state: "COMPLETED",
      amount,
      method: "STORE_CREDIT",
      completedAt: new Date(),
    };

    response.refundId = storeCreditId;
    return response;
  } catch (error) {
    console.error("Store credit refund failed:", error);
    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: { refundState: "FAILED", refundAmount: amount },
    });
    throw error;
  }
}

/**
 * Check refund status for a payment transaction
 */
export async function checkRefundStatus(
  transactionId: string,
): Promise<RefundStatusResponse> {
  const transaction = await prisma.bookingPaymentTransaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    throw new Error("Payment transaction not found");
  }

  // A refund exists if either the gateway refund ID or the merchant-side
  // tracking ID is set. Card refunds may not receive a refundId synchronously.
  if (!transaction.refundId && !transaction.refundMerchantId) {
    throw new Error("No refund found for this transaction");
  }

  const refundResponse = transaction.refundResponse as RefundResponseJson;

  // Handle store credit refunds (already completed)
  if (
    refundResponse?.method === "STORE_CREDIT" &&
    transaction.refundState === "COMPLETED"
  ) {
    const response: RefundStatusResponse = {
      transactionId: transaction.id,
      state: "COMPLETED",
      amount: transaction.refundAmount || 0,
      method: "STORE_CREDIT",
      ...(refundResponse?.completedAt
        ? { completedAt: refundResponse.completedAt }
        : {}),
    };

    if (transaction.refundId) {
      response.refundId = transaction.refundId;
    }

    return response;
  }

  // Handle bank transfers (manual process)
  if (refundResponse?.method === "BANK_TRANSFER") {
    const response: RefundStatusResponse = {
      transactionId: transaction.id,
      state: transaction.refundState || "INITIATED",
      amount: transaction.refundAmount || 0,
      method: "BANK_TRANSFER",
      ...(refundResponse?.failureReason
        ? { failureReason: refundResponse.failureReason }
        : {}),
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

    // Update transaction with latest status (updatedAt is bumped automatically).
    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        ...(status.state ? { refundState: status.state } : {}),
      },
    });

    const response: RefundStatusResponse = {
      transactionId: transaction.id,
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
    console.error("Error checking refund status:", error);
    const response: RefundStatusResponse = {
      transactionId: transaction.id,
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
  // TODO(prisma): the old Mongo query filtered out BANK_TRANSFER refunds via a
  // JSON-path condition ("refundResponse.method"). Fetch INITIATED refunds and
  // exclude bank transfers in application code to preserve behavior.
  const initiatedRefunds = await prisma.bookingPaymentTransaction.findMany({
    where: { refundState: "INITIATED" },
  });
  const pendingRefunds = initiatedRefunds.filter((t) => {
    const method = (t.refundResponse as RefundResponseJson)?.method;
    return method !== "BANK_TRANSFER";
  });

  let completed = 0;
  let failed = 0;

  for (const transaction of pendingRefunds) {
    try {
      const status = await checkRefundStatus(transaction.id);

      if (status.state === "COMPLETED") {
        completed++;
        // Flip the parent booking to PROCESSED so admin panel and player UI update.
        if (transaction.bookingId) {
          await prisma.booking
            .updateMany({
              where: {
                id: transaction.bookingId,
                refundStatus: { not: "PROCESSED" },
              },
              data: { refundStatus: "PROCESSED" },
            })
            .catch(() => {});
        }
        // Send completion notification
        const user = await prisma.user.findUnique({
          where: { id: transaction.userId },
        });
        if (user) {
          await NotificationService.send(
            {
              userId: user.id,
              type: "PAYMENT_REFUND",
              title: "Refund completed",
              message: `Your refund of ₹${((transaction.refundAmount || 0) / 100).toLocaleString("en-IN")} has been completed.`,
              data: {
                amount: transaction.refundAmount || 0,
                method: "ORIGINAL_CARD",
                transactionId: transaction.id,
              },
            },
            { sendEmail: true, sendPush: true },
          );
        }
      } else if (status.state === "FAILED") {
        failed++;
      }
    } catch (error) {
      console.error(`Error updating refund ${transaction.id}:`, error);
    }
  }

  return {
    checked: pendingRefunds.length,
    completed,
    failed,
  };
}
