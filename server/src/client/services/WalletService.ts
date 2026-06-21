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

export class WalletService {
  /**
   * Retrieves the wallet for a user. Creates one if it doesn't exist.
   */
  static async getWallet(userId: string) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    return wallet;
  }

  /**
   * Directly credits the wallet (e.g. for Refunds).
   */
  static async creditWallet(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ) {
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

    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: amount },
        $push: { transactions: { $each: [transaction], $position: 0 } },
      },
      { new: true, upsert: true }
    );

    return { wallet, transaction };
  }

  /**
   * Directly debits the wallet.
   */
  static async debitWallet(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    if (wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

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

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: amount } }, // ensure balance is still sufficient
      {
        $inc: { balance: -amount },
        $push: { transactions: { $each: [transaction], $position: 0 } },
      },
      { new: true }
    );

    if (!updatedWallet) {
      throw new Error("Concurrent transaction altered balance. Please try again.");
    }

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Initiates a top-up via PhonePe gateway.
   */
  static async initiateTopUp(userId: string, amount: number) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const merchantOrderId = `WTOPUP-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const redirectUrl = `${getFrontendUrl()}/dashboard/wallet/verify?orderId=${merchantOrderId}`;

    // Create a pending transaction
    const transaction: WalletTransaction = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: "CREDIT",
      amount,
      status: "PENDING",
      reason: "Wallet Top Up",
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
   */
  static async verifyTopUp(userId: string, merchantOrderId: string) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error("Wallet not found");

    const transaction = wallet.transactions.find(
      (t) => t.referenceId === merchantOrderId && t.reason === "Wallet Top Up"
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
      // It's a success, update balance and transaction status
      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId, "transactions.id": transaction.id, "transactions.status": "PENDING" },
        {
          $inc: { balance: transaction.amount },
          $set: { "transactions.$.status": "COMPLETED" },
        },
        { new: true }
      );

      if (!updatedWallet) {
        // Already processed concurrently
        return { status: "COMPLETED", amount: transaction.amount, wallet: await Wallet.findOne({ userId }) };
      }

      return { status: "COMPLETED", amount: transaction.amount, wallet: updatedWallet };
    } else if (phonePeStatus.state === "FAILED") {
      // Mark as failed
      await Wallet.updateOne(
        { userId, "transactions.id": transaction.id },
        { $set: { "transactions.$.status": "FAILED" } }
      );
      return { status: "FAILED", wallet };
    }

    return { status: "PENDING", wallet };
  }
}
