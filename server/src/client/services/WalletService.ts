import mongoose from "mongoose";
import { Wallet, WalletTransaction } from "../models/Wallet";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
} from "../../shared/services/PhonePeService";
import { User } from "../models/User";

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:3000";
};

const TOP_UP_REASON = "Wallet Top Up";
const TOP_UP_ORDER_PREFIX = "WTOPUP-";

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export class WalletService {
  /**
   * Retrieves the wallet for a user. Creates one if it doesn't exist.
   */
  static async getWallet(userId: string) {
    // Read-only — never saved after this, so .lean() on the common (already
    // exists) path skips Mongoose document hydration for no behavior change.
    const wallet = await Wallet.findOne({ userId }).lean();
    if (wallet) {
      return wallet;
    }
    return Wallet.create({ userId, balance: 0, transactions: [] });
  }

  /**
   * Directly credits the wallet (e.g. for Refunds).
   *
   * With a `referenceId` this is IDEMPOTENT: the same (reference, reason) pair is
   * credited at most once, however many times and however concurrently it is
   * asked. A refund that is retried after a failed save, or raced by a second
   * trigger, must not pay the user twice. The guard is part of the update's own
   * filter, so it is atomic with the credit; when it blocks, the upsert collides
   * with the unique `userId` index, which is how "already credited" is told
   * apart from "no wallet yet".
   */
  static async creditWallet(userId: string, amount: number, reason: string, referenceId?: string) {
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const transaction: WalletTransaction = {
      id: transactionId,
      type: "CREDIT",
      amount,
      status: "COMPLETED",
      reason,
      ...(referenceId !== undefined ? { referenceId } : {}),
      createdAt: new Date(),
    };

    const filter: Record<string, unknown> = { userId };
    if (referenceId !== undefined) {
      filter.transactions = {
        $not: { $elemMatch: { type: "CREDIT", referenceId, reason } },
      };
    }

    try {
      const wallet = await Wallet.findOneAndUpdate(
        filter,
        {
          $inc: { balance: amount },
          $push: { transactions: { $each: [transaction], $position: 0 } },
        },
        { new: true, upsert: true }
      );

      return { wallet, transaction };
    } catch (error) {
      if (referenceId !== undefined && isDuplicateKeyError(error)) {
        const wallet = await Wallet.findOne({ userId });
        const existing = wallet?.transactions.find(
          (t) => t.type === "CREDIT" && t.referenceId === referenceId && t.reason === reason
        );
        if (wallet && existing) {
          return { wallet, transaction: existing, alreadyApplied: true };
        }
      }
      throw error;
    }
  }

  /**
   * Directly debits the wallet.
   *
   * Atomic on the balance (the `$gte` guard lives in the update's filter) and,
   * with a `referenceId`, IDEMPOTENT: a second debit for the same reference
   * returns the first one instead of charging again. Paying a booking is the
   * caller, and it must be safe to repeat after a crash or a double tap.
   */
  static async debitWallet(userId: string, amount: number, reason: string, referenceId?: string) {
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const transaction: WalletTransaction = {
      id: transactionId,
      type: "DEBIT",
      amount,
      status: "COMPLETED",
      reason,
      ...(referenceId !== undefined ? { referenceId } : {}),
      createdAt: new Date(),
    };

    const filter: Record<string, unknown> = { userId, balance: { $gte: amount } };
    if (referenceId !== undefined) {
      filter.transactions = {
        $not: { $elemMatch: { type: "DEBIT", referenceId, status: { $ne: "FAILED" } } },
      };
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      filter,
      {
        $inc: { balance: -amount },
        $push: { transactions: { $each: [transaction], $position: 0 } },
      },
      { new: true }
    );

    if (updatedWallet) {
      return { wallet: updatedWallet, transaction };
    }

    // Nothing matched. Find out why, so the caller gets the right answer.
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    if (referenceId !== undefined) {
      const existing = wallet.transactions.find(
        (t) => t.type === "DEBIT" && t.referenceId === referenceId && t.status !== "FAILED"
      );
      if (existing) {
        return { wallet, transaction: existing, alreadyApplied: true };
      }
    }
    if (wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }
    throw new Error("Concurrent transaction altered balance. Please try again.");
  }

  /**
   * Initiates a top-up via PhonePe gateway.
   */
  static async initiateTopUp(userId: string, amount: number) {
    const user = await User.findById(userId).select("phone").lean();
    if (!user) throw new Error("User not found");

    const merchantOrderId = `${TOP_UP_ORDER_PREFIX}${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const redirectUrl = `${getFrontendUrl()}/dashboard/wallet/verify?orderId=${merchantOrderId}`;

    // Create a pending transaction
    const transaction: WalletTransaction = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: "CREDIT",
      amount,
      status: "PENDING",
      reason: TOP_UP_REASON,
      referenceId: merchantOrderId,
      createdAt: new Date(),
    };

    await Wallet.findOneAndUpdate(
      { userId },
      { $push: { transactions: { $each: [transaction], $position: 0 } } },
      { upsert: true }
    );

    const initResult = await initiatePhonePePayment({
      merchantOrderId,
      amount: Math.round(amount * 100), // PhonePe expects paise if INR, but initiatePhonePePayment might do it or not?
      // Wait, in standard pg-sdk-node, amount is typically in paise. But let's check what RefundService does...
      // PhonePe SDK usually takes rupees or paise? The PhonePe docs say amount in paise.
      // Looking at `PhonePeService.ts`, `RefundRequest` explicitly does `Math.round(amount * 100)`.
      // The `buildPayRequest` does not do `* 100`. So I'll do `Math.round(amount * 100)` here assuming paise.
      redirectUrl,
      userPhone: user.phone,
    });

    return {
      merchantOrderId,
      redirectUrl: initResult.redirectUrl,
    };
  }

  /**
   * Verifies the top-up transaction status from PhonePe.
   *
   * Reached from two places that can overlap: the user's browser polling after
   * the redirect, and the payment webhook. Both settle through the same atomic
   * step below, so whichever lands second finds the top-up already settled and
   * credits nothing.
   */
  static async verifyTopUp(userId: string, merchantOrderId: string) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error("Wallet not found");

    const transaction = wallet.transactions.find(
      (t) => t.referenceId === merchantOrderId && t.reason === TOP_UP_REASON
    );

    if (!transaction) throw new Error("Top-up transaction not found");

    if (transaction.status === "COMPLETED") {
      return { status: "COMPLETED", amount: transaction.amount, wallet };
    }

    if (transaction.status === "FAILED") {
      return { status: "FAILED", wallet };
    }

    const phonePeStatus = await getPhonePeOrderStatus(merchantOrderId);

    if (phonePeStatus.state === "COMPLETED") {
      // SECURITY: only credit the wallet if PhonePe actually settled the same
      // amount the user initiated. transaction.amount is in rupees; PhonePe
      // reports paise. Without this check a user could initiate a large top-up
      // and pay (or be charged) a smaller amount yet receive full credit.
      const expectedPaise = Math.round(transaction.amount * 100);
      if (typeof phonePeStatus.amount !== "number" || phonePeStatus.amount !== expectedPaise) {
        throw new Error("Top-up amount mismatch");
      }

      // One atomic step: only a top-up that is STILL pending is credited and
      // flipped. The $elemMatch ties the id and the status to the SAME array
      // element; as two separate conditions they could match different entries,
      // and a stray abandoned PENDING top-up would let a second verify credit
      // the same payment again.
      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId, transactions: { $elemMatch: { id: transaction.id, status: "PENDING" } } },
        {
          $inc: { balance: transaction.amount },
          $set: { "transactions.$[t].status": "COMPLETED" },
        },
        { new: true, arrayFilters: [{ "t.id": transaction.id, "t.status": "PENDING" }] }
      );

      if (!updatedWallet) {
        // Already settled by the other path.
        return {
          status: "COMPLETED",
          amount: transaction.amount,
          wallet: await Wallet.findOne({ userId }),
        };
      }

      return {
        status: "COMPLETED",
        amount: transaction.amount,
        wallet: updatedWallet,
      };
    } else if (phonePeStatus.state === "FAILED") {
      // Only a pending top-up can fail; never overwrite one that completed.
      await Wallet.updateOne(
        { userId, transactions: { $elemMatch: { id: transaction.id, status: "PENDING" } } },
        { $set: { "transactions.$[t].status": "FAILED" } },
        { arrayFilters: [{ "t.id": transaction.id, "t.status": "PENDING" }] }
      );
      return { status: "FAILED", wallet };
    }

    return { status: "PENDING", wallet };
  }
}

/**
 * Credits a wallet top-up from a PhonePe webhook, so a user who pays and closes
 * the tab is still credited. Before this, a top-up was only ever credited when
 * the user's own browser came back and called verify.
 *
 * The webhook body is used only to find the order. The amount and state come
 * from PhonePe's order-status API through `verifyTopUp`, the same authoritative
 * check the browser path uses, so a forged or replayed body cannot credit
 * anything. Safe to call repeatedly: an already-settled top-up credits nothing.
 *
 * Returns null for anything that is not a wallet top-up.
 */
export const reconcileWalletTopUpFromWebhookPayload = async (rawPayload: unknown) => {
  const payload = asRecord(rawPayload);
  const inner = asRecord(payload.payload);
  const data = asRecord(payload.data);

  const candidates = [
    payload.merchantOrderId,
    inner.merchantOrderId,
    data.merchantOrderId,
    asRecord(inner.paymentDetails).merchantOrderId,
    asRecord(data.paymentDetails).merchantOrderId,
  ];
  const merchantOrderId = candidates.find(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (!merchantOrderId || !merchantOrderId.startsWith(TOP_UP_ORDER_PREFIX)) {
    return null;
  }

  const wallet = await Wallet.findOne({
    transactions: { $elemMatch: { referenceId: merchantOrderId, reason: TOP_UP_REASON } },
  }).select("userId");
  if (!wallet) {
    return null;
  }

  return WalletService.verifyTopUp(String(wallet.userId), merchantOrderId);
};
