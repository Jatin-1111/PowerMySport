/**
 * Scheduled jobs for maintenance and cleanup tasks
 * Run periodically via cron or job scheduler
 */

import {
  cleanupExpiredBookings,
  cleanupStaleBookingLocks,
} from "../client/services/BookingService";
import { cleanupExpiredCodes } from "../shared/services/EmailVerificationService";
import { bootFact } from "./boot";
import { cleanupExpiredCoachSubscriptions } from "../client/services/CoachSubscriptionService";
import { processWaitlistNotifications } from "../shop/services/shopScheduledJobs";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("scheduledJobs");

/**
 * Auto-release payments 24 hours after session completion
 * REQUIREMENT 1: Payment should be automatically released after 24hrs of session
 */
export const releaseCompletedBookingPayments = async (): Promise<void> => {
  try {
    const { Booking } = await import("../client/models/Booking");
    const { BookingPaymentTransaction } =
      await import("../client/models/BookingPayment");
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const completedBookings = await Booking.find({
      status: "COMPLETED",
      updatedAt: { $lte: twentyFourHoursAgo },
      "payments.status": "PENDING",
      // Only release payouts for bookings where the player actually paid
      paymentConfirmedAt: { $ne: null },
    });

    let releasedCount = 0;

    for (const booking of completedBookings) {
      // Cross-reference: verify a real payment transaction was completed
      const confirmedTx = await BookingPaymentTransaction.findOne({
        bookingId: booking._id,
        status: "COMPLETED",
      });
      if (!confirmedTx) {
        log.warn(
          `Skipping payout release for booking ${booking._id}: no confirmed payment transaction found`,
        );
        continue;
      }

      // Only release payee entries (VENUE_LISTER / COACH / ACADEMY).
      // The PLAYER entry is already marked PAID by updatePaymentStatus().
      const released: Array<{ userId: string; userType: string; amountPaise: number }> =
        [];
      booking.payments = booking.payments.map((payment: any) => {
        if (payment.status === "PENDING" && payment.userType !== "Player") {
          payment.status = "PAID";
          payment.paidAt = now;
          released.push({
            userId: payment.userId?.toString(),
            userType: payment.userType,
            amountPaise: Math.round((payment.amount ?? 0) * 100),
          });
        }
        return payment;
      });

      await booking.save();
      releasedCount++;

      if (released.length > 0) {
        const { recordBookingEventFor } = await import(
          "../client/services/BookingEventService"
        );
        await recordBookingEventFor(booking, {
          type: "PAYOUT_RELEASED",
          toStatus: booking.status,
          actorType: "SYSTEM",
          channel: "CRON",
          amountPaise: released.reduce(
            (sum, payee) => sum + payee.amountPaise,
            0,
          ),
          summary: `Payout released to ${released.length} payee(s), 24h after completion`,
          metadata: {
            payees: released,
            confirmedTransactionId: confirmedTx._id.toString(),
          },
        });
      }
    }

    if (releasedCount > 0) {
      log.info(
        `Auto-released payments for ${releasedCount} completed booking(s)`,
      );
    }
  } catch (error) {
    log.error("Error releasing completed booking payments:", error);
  }
};

/**
 * Retry booking refunds that are PENDING but never got an INITIATED refund at PhonePe.
 * Covers two cases:
 *  - Payment was still settling when the user cancelled (race condition)
 *  - PhonePe rejected the initial attempt transiently (FAILED state)
 */
export const retryPendingBookingRefunds = async (): Promise<void> => {
  try {
    const { Booking } = await import("../client/models/Booking");
    const { BookingPaymentTransaction } = await import(
      "../client/models/BookingPayment"
    );
    const { initiatePhonePeRefund } = await import(
      "../shared/services/PhonePeService"
    );
    const { randomBytes } = await import("crypto");

    // Find cancelled bookings with a pending refund that was never successfully initiated.
    const pendingBookings = await Booking.find({
      status: "CANCELLED",
      refundStatus: "PENDING",
      refundAmount: { $gt: 0 },
    }).limit(50);

    let retried = 0;
    let succeeded = 0;

    for (const booking of pendingBookings) {
      // Only retry when the payment has settled — COMPLETED transaction required.
      const transaction = await BookingPaymentTransaction.findOne({
        bookingId: booking._id,
        status: "COMPLETED",
        $or: [
          { refundState: { $exists: false } },
          { refundState: null },
          { refundState: "FAILED" },
        ],
      }).sort({ createdAt: -1 });

      if (!transaction) continue; // payment not settled yet — try next run

      const amountPaise = Math.round((booking.refundAmount ?? 0) * 100);
      if (amountPaise < 100) continue;

      const refundMerchantId = `rf_${Date.now()}_${randomBytes(4).toString("hex")}`;
      try {
        retried++;
        const response = await initiatePhonePeRefund({
          merchantRefundId: refundMerchantId,
          originalMerchantOrderId: transaction.merchantOrderId,
          amount: amountPaise / 100,
        });

        const refundState = response.state || "INITIATED";
        transaction.refundMerchantId = refundMerchantId;
        if (response.refundId) transaction.refundId = response.refundId;
        transaction.refundState = refundState;
        transaction.refundAmount = amountPaise;
        transaction.refundResponse = response.raw;
        await transaction.save();

        if (refundState === "COMPLETED") {
          booking.refundStatus = "PROCESSED";
          await booking.save();
          succeeded++;
        }
        // If INITIATED — pollPendingRefunds will confirm and flip to PROCESSED.

        const { recordBookingEventFor } = await import(
          "../client/services/BookingEventService"
        );
        await recordBookingEventFor(booking, {
          type:
            refundState === "COMPLETED"
              ? "REFUND_COMPLETED"
              : "REFUND_INITIATED",
          actorType: "SYSTEM",
          channel: "CRON",
          amountPaise,
          summary: `Refund retry succeeded (${refundState})`,
          metadata: {
            refundMerchantId,
            refundState,
            transactionId: transaction._id.toString(),
            trigger: "refund_retry_job",
          },
        });
      } catch (err) {
        log.error(
          `Refund retry failed for booking ${booking._id}:`,
          err,
        );
        // Leave refundStatus as PENDING — try again next run.

        const { recordBookingEventFor } = await import(
          "../client/services/BookingEventService"
        );
        await recordBookingEventFor(booking, {
          type: "REFUND_FAILED",
          actorType: "SYSTEM",
          channel: "CRON",
          amountPaise,
          summary: "Refund retry failed — will attempt again next run",
          metadata: {
            refundMerchantId,
            transactionId: transaction._id.toString(),
            trigger: "refund_retry_job",
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    if (retried > 0) {
      log.info(
        `Refund retry: ${retried} attempted, ${succeeded} immediately completed`,
      );
    }
  } catch (error) {
    log.error("Error retrying pending booking refunds:", error);
  }
};

/**
 * Poll pending refunds and update their status
 * REQUIREMENT 4: Track refund progress via PhonePe polling
 */
export const pollPendingRefunds = async (): Promise<void> => {
  try {
    const { updatePendingRefundStatuses } =
      await import("../client/services/RefundService");
    const result = await updatePendingRefundStatuses();

    if (result.checked > 0) {
      log.info(
        `Refund polling: ${result.checked} checked, ${result.completed} completed, ${result.failed} failed`,
      );
    }
  } catch (error) {
    log.error("Error polling pending refunds:", error);
  }
};

/**
 * Run all cleanup tasks.
 * Scheduled to run every 15–60 minutes depending on environment.
 */
export const runScheduledCleanup = async (): Promise<void> => {
  const done: string[] = [];

  try {
    await retryPendingBookingRefunds();
    await pollPendingRefunds();
    await releaseCompletedBookingPayments();

    const expiredBookingsCount = await cleanupExpiredBookings();
    if (expiredBookingsCount) done.push(`${expiredBookingsCount} booking(s) cancelled`);

    const staleLocks = await cleanupStaleBookingLocks();
    if (staleLocks) done.push(`${staleLocks} stale lock(s) cleared`);

    await cleanupExpiredCodes();

    const expiredSubscriptions = await cleanupExpiredCoachSubscriptions();
    if (expiredSubscriptions)
      done.push(`${expiredSubscriptions} subscription(s) expired`);

    await processWaitlistNotifications();

    // ── Expert sessions ──────────────────────────────────────────────────────
    try {
      const {
        expireUnpaidExpertHolds,
        sendExpertMomReminders,
        sendExpertReviewReminders,
        releaseExpertSessionPayouts,
        sendExpertMeetingLinkNudges,
        sendSessionStartReminders,
      } = await import("../client/services/ExpertsService");
      const expiredHolds = await expireUnpaidExpertHolds();
      if (expiredHolds > 0)
        log.info(`Expired ${expiredHolds} unpaid expert hold(s)`);
      const momReminders = await sendExpertMomReminders();
      if (momReminders > 0)
        log.info(`Sent ${momReminders} session-notes reminder(s)`);
      const reminded = await sendExpertReviewReminders();
      if (reminded > 0)
        log.info(`Sent ${reminded} expert review reminder(s)`);
      const releasedPayouts = await releaseExpertSessionPayouts();
      if (releasedPayouts > 0)
        log.info(
          `Auto-released ${releasedPayouts} expert session payout(s)`,
        );
      const linkNudges = await sendExpertMeetingLinkNudges();
      if (linkNudges > 0)
        log.info(`Sent ${linkNudges} meeting-link nudge(s)`);
      const startReminders = await sendSessionStartReminders();
      if (startReminders > 0)
        log.info(
          `Sent ${startReminders} session-starting-soon reminder(s)`,
        );
    } catch (expertErr) {
      log.error("Expert session maintenance failed:", expertErr);
    }

    // ── Pending account deletions ────────────────────────────────────────────
    try {
      const { finalizePendingAccountDeletions } = await import(
        "../shared/services/AuthService"
      );
      const finalized = await finalizePendingAccountDeletions();
      if (finalized > 0)
        log.info(`Finalized ${finalized} pending account deletion(s)`);
    } catch (deletionErr) {
      log.error(
        "Pending account deletion finalization failed:",
        deletionErr,
      );
    }

    // Silence when there was nothing to do — this runs every 15 minutes and
    // a no-op sweep is not news.
    if (done.length) log.info(`cleanup: ${done.join(", ")}`);
  } catch (error) {
    log.error("Scheduled cleanup failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Initialize scheduled jobs.
 * Call this once when the server starts.
 */
export const initializeScheduledJobs = (): void => {

  // ── General cleanup ──────────────────────────────────────────────────────
  const defaultCleanupIntervalMinutes =
    process.env.NODE_ENV === "production" ? 60 : 15;
  const configuredCleanupIntervalMinutes = parseInt(
    process.env.SCHEDULED_CLEANUP_INTERVAL_MINUTES ||
      String(defaultCleanupIntervalMinutes),
    10,
  );
  const CLEANUP_INTERVAL =
    Math.max(5, configuredCleanupIntervalMinutes) * 60 * 1000;

  const cleanupIntervalHandle = setInterval(async () => {
    try {
      await runScheduledCleanup();
    } catch (error) {
      log.error("Scheduled cleanup failed:", error);
    }
  }, CLEANUP_INTERVAL);
  cleanupIntervalHandle.unref();

  // Initial cleanup run 5 seconds after startup
  const initialCleanupHandle = setTimeout(async () => {
    try {
      await runScheduledCleanup();
    } catch (error) {
      log.error("Initial cleanup failed:", error);
    }
  }, 5_000);
  initialCleanupHandle.unref();

  bootFact("jobs", `cleanup ${CLEANUP_INTERVAL / 60_000}m`);

  // ── Pathway pre-warm (once at startup) ───────────────────────────────────
  // Pre-warming of 'any' locality generic sports is disabled.

};
