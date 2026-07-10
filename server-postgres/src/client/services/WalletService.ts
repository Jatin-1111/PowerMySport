import type { WalletTransaction } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
} from "../../shared/services/PhonePeService";

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:3000";
};

// Transactions are read newest-first to mirror the old `$position:0` prepend.
const txnOrder = { orderBy: { createdAt: "desc" as const } };

export class WalletService {
  /**
   * Retrieves the wallet for a user. Creates one if it doesn't exist.
   */
  static async getWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: txnOrder },
    });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 0 },
        include: { transactions: txnOrder },
      });
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
    referenceId?: string,
  ) {
    const externalId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return prisma.$transaction(async (tx) => {
      // Upsert keeps the old `{ upsert:true }` behavior; $inc -> increment.
      const base = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      });

      const transaction: WalletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: base.id,
          externalId,
          type: "CREDIT",
          amount,
          status: "COMPLETED",
          reason,
          ...(referenceId !== undefined ? { referenceId } : {}),
        },
      });

      const wallet = await tx.wallet.findUnique({
        where: { id: base.id },
        include: { transactions: txnOrder },
      });

      return { wallet, transaction };
    });
  }

  /**
   * Directly debits the wallet.
   */
  static async debitWallet(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string,
  ) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    if (wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    const externalId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return prisma.$transaction(async (tx) => {
      // Conditional decrement (balance still >= amount) guards concurrent debits,
      // mirroring the Mongo `{ balance: { $gte: amount } }` update filter.
      const res = await tx.wallet.updateMany({
        where: { userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });

      if (res.count === 0) {
        throw new Error(
          "Concurrent transaction altered balance. Please try again.",
        );
      }

      const transaction: WalletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          externalId,
          type: "DEBIT",
          amount,
          status: "COMPLETED",
          reason,
          ...(referenceId !== undefined ? { referenceId } : {}),
        },
      });

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        include: { transactions: txnOrder },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Initiates a top-up via PhonePe gateway.
   */
  static async initiateTopUp(userId: string, amount: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const merchantOrderId = `WTOPUP-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const redirectUrl = `${getFrontendUrl()}/dashboard/wallet/verify?orderId=${merchantOrderId}`;

    // Create a pending transaction (ensuring the wallet exists first).
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        externalId: `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: "CREDIT",
        amount,
        status: "PENDING",
        reason: "Wallet Top Up",
        referenceId: merchantOrderId,
      },
    });

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
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: txnOrder },
    });
    if (!wallet) throw new Error("Wallet not found");

    const transaction = wallet.transactions.find(
      (t) => t.referenceId === merchantOrderId && t.reason === "Wallet Top Up",
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
      if (
        typeof phonePeStatus.amount !== "number" ||
        phonePeStatus.amount !== expectedPaise
      ) {
        throw new Error("Top-up amount mismatch");
      }

      // It's a success — flip the pending txn to COMPLETED and credit balance.
      // The conditional updateMany (status still PENDING) makes this idempotent
      // under concurrent verification, replacing Mongo's positional update.
      return prisma.$transaction(async (tx) => {
        const flipped = await tx.walletTransaction.updateMany({
          where: { id: transaction.id, status: "PENDING" },
          data: { status: "COMPLETED" },
        });

        if (flipped.count === 0) {
          // Already processed concurrently
          return {
            status: "COMPLETED",
            amount: transaction.amount,
            wallet: await tx.wallet.findUnique({
              where: { userId },
              include: { transactions: txnOrder },
            }),
          };
        }

        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: transaction.amount } },
          include: { transactions: txnOrder },
        });

        return {
          status: "COMPLETED",
          amount: transaction.amount,
          wallet: updatedWallet,
        };
      });
    } else if (phonePeStatus.state === "FAILED") {
      // Mark as failed
      await prisma.walletTransaction.updateMany({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });
      return { status: "FAILED", wallet };
    }

    return { status: "PENDING", wallet };
  }
}
