/**
 * Scheduled jobs for maintenance and cleanup tasks
 * Run periodically via cron or job scheduler
 */

import prisma from "../lib/prisma";
import {
  cleanupExpiredBookings,
  cleanupStaleBookingLocks,
} from "../client/services/BookingService";
import { cleanupExpiredCodes } from "../shared/services/EmailVerificationService";
import { cleanupExpiredCoachSubscriptions } from "../client/services/CoachSubscriptionService";
import { processWaitlistNotifications } from "../shop/services/shopScheduledJobs";
import { pathwayService } from "../shared/services/PathwayService";

/**
 * Auto-release payments 24 hours after session completion
 * REQUIREMENT 1: Payment should be automatically released after 24hrs of session
 */
export const releaseCompletedBookingPayments = async (): Promise<void> => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const completedBookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        updatedAt: { lte: twentyFourHoursAgo },
        // at least one payout leg still pending
        payments: { some: { status: "PENDING" } },
        // Only release payouts for bookings where the player actually paid
        paymentConfirmedAt: { not: null },
      },
      select: { id: true },
    });

    let releasedCount = 0;

    for (const booking of completedBookings) {
      // Cross-reference: verify a real payment transaction was completed
      const confirmedTx = await prisma.bookingPaymentTransaction.findFirst({
        where: { bookingId: booking.id, status: "COMPLETED" },
      });
      if (!confirmedTx) {
        console.warn(
          `⚠️ Skipping payout release for booking ${booking.id}: no confirmed payment transaction found`,
        );
        continue;
      }

      // Only release payee entries (VenueLister / Coach).
      // The Player entry is already marked PAID by updatePaymentStatus().
      const { count } = await prisma.bookingPaymentLeg.updateMany({
        where: {
          bookingId: booking.id,
          status: "PENDING",
          userType: { not: "Player" },
        },
        data: { status: "PAID", paidAt: now },
      });

      if (count > 0) releasedCount++;
    }

    if (releasedCount > 0) {
      console.log(
        `✅ Auto-released payments for ${releasedCount} completed booking(s)`,
      );
    }
  } catch (error) {
    console.error("❌ Error releasing completed booking payments:", error);
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
    const { initiatePhonePeRefund } = await import(
      "../shared/services/PhonePeService"
    );
    const { randomBytes } = await import("crypto");

    // Find cancelled bookings with a pending refund that was never successfully initiated.
    const pendingBookings = await prisma.booking.findMany({
      where: {
        status: "CANCELLED",
        refundStatus: "PENDING",
        refundAmount: { gt: 0 },
      },
      take: 50,
    });

    let retried = 0;
    let succeeded = 0;

    for (const booking of pendingBookings) {
      // Only retry when the payment has settled — COMPLETED transaction required
      // and the refund was never initiated (null refundState) or previously failed.
      const transaction = await prisma.bookingPaymentTransaction.findFirst({
        where: {
          bookingId: booking.id,
          status: "COMPLETED",
          OR: [{ refundState: null }, { refundState: "FAILED" }],
        },
        orderBy: { createdAt: "desc" },
      });

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
        await prisma.bookingPaymentTransaction.update({
          where: { id: transaction.id },
          data: {
            refundMerchantId,
            ...(response.refundId ? { refundId: response.refundId } : {}),
            refundState,
            refundAmount: amountPaise,
            refundResponse: response.raw as any,
          },
        });

        if (refundState === "COMPLETED") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { refundStatus: "PROCESSED" },
          });
          succeeded++;
        }
        // If INITIATED — pollPendingRefunds will confirm and flip to PROCESSED.
      } catch (err) {
        console.error(
          `❌ Refund retry failed for booking ${booking.id}:`,
          err,
        );
        // Leave refundStatus as PENDING — try again next run.
      }
    }

    if (retried > 0) {
      console.log(
        `✅ Refund retry: ${retried} attempted, ${succeeded} immediately completed`,
      );
    }
  } catch (error) {
    console.error("❌ Error retrying pending booking refunds:", error);
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
      console.log(
        `✅ Refund polling: ${result.checked} checked, ${result.completed} completed, ${result.failed} failed`,
      );
    }
  } catch (error) {
    console.error("❌ Error polling pending refunds:", error);
  }
};

/**
 * Refresh stale sport pathways via Gemini scraper.
 * Finds pathways that haven't been refreshed in PATHWAY_STALE_DAYS (default: 30)
 * and regenerates them sequentially to respect Gemini rate limits.
 */
export const refreshStalePathways = async (): Promise<void> => {
  try {
    console.log("[PathwayScheduler] 🔍 Checking for stale pathways...");
    const staleCacheKeys = await pathwayService.getStalePathways();

    if (staleCacheKeys.length === 0) {
      console.log("[PathwayScheduler] ✅ No stale pathways found.");
      return;
    }

    console.log(
      `[PathwayScheduler] 🔄 Refreshing ${staleCacheKeys.length} stale pathway(s)...`,
    );

    let refreshed = 0;
    for (const cacheKey of staleCacheKeys) {
      const result = await pathwayService.refreshPathway(cacheKey);
      if (result) refreshed++;
      // 2-second stagger to respect Gemini API rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(
      `[PathwayScheduler] ✅ Stale refresh complete: ${refreshed}/${staleCacheKeys.length} refreshed.`,
    );
  } catch (error) {
    console.error("❌ Error refreshing stale pathways:", error);
  }
};

/**
 * Run all cleanup tasks.
 * Scheduled to run every 15–60 minutes depending on environment.
 */
export const runScheduledCleanup = async (): Promise<void> => {
  console.log("🔄 Starting scheduled cleanup tasks...");

  try {
    await retryPendingBookingRefunds();
    await pollPendingRefunds();
    await releaseCompletedBookingPayments();

    const expiredBookingsCount = await cleanupExpiredBookings();
    console.log(`✅ Cancelled ${expiredBookingsCount} expired booking(s)`);

    const staleLocks = await cleanupStaleBookingLocks();
    console.log(`✅ Cleaned up ${staleLocks} stale booking lock(s)`);

    await cleanupExpiredCodes();
    console.log(`✅ Cleaned up expired email verification codes`);

    const expiredSubscriptions = await cleanupExpiredCoachSubscriptions();
    console.log(`✅ Expired ${expiredSubscriptions} coach subscription(s)`);

    await processWaitlistNotifications();

    // ── Expert sessions ──────────────────────────────────────────────────────
    try {
      const {
        expireUnpaidExpertHolds,
        autoCompleteExpertSessions,
        sendExpertReviewReminders,
        releaseExpertSessionPayouts,
        sendExpertMeetingLinkNudges,
        sendSessionStartReminders,
      } = await import("../client/services/ExpertsService");
      const expiredHolds = await expireUnpaidExpertHolds();
      if (expiredHolds > 0)
        console.log(`✅ Expired ${expiredHolds} unpaid expert hold(s)`);
      const autoCompleted = await autoCompleteExpertSessions();
      if (autoCompleted > 0)
        console.log(`✅ Auto-completed ${autoCompleted} expert session(s)`);
      const reminded = await sendExpertReviewReminders();
      if (reminded > 0)
        console.log(`✅ Sent ${reminded} expert review reminder(s)`);
      const releasedPayouts = await releaseExpertSessionPayouts();
      if (releasedPayouts > 0)
        console.log(
          `✅ Auto-released ${releasedPayouts} expert session payout(s)`,
        );
      const linkNudges = await sendExpertMeetingLinkNudges();
      if (linkNudges > 0)
        console.log(`✅ Sent ${linkNudges} meeting-link nudge(s)`);
      const startReminders = await sendSessionStartReminders();
      if (startReminders > 0)
        console.log(
          `✅ Sent ${startReminders} session-starting-soon reminder(s)`,
        );
    } catch (expertErr) {
      console.error("❌ Expert session maintenance failed:", expertErr);
    }

    console.log("✅ Scheduled cleanup completed successfully");
  } catch (error) {
    console.error("❌ Error during scheduled cleanup:", error);
    throw error;
  }
};

/**
 * Initialize scheduled jobs.
 * Call this once when the server starts.
 */
export const initializeScheduledJobs = (): void => {
  console.log("⏰ Initializing scheduled jobs...");

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
      console.error("❌ Scheduled cleanup failed:", error);
    }
  }, CLEANUP_INTERVAL);
  cleanupIntervalHandle.unref();

  // Initial cleanup run 5 seconds after startup
  const initialCleanupHandle = setTimeout(async () => {
    try {
      await runScheduledCleanup();
    } catch (error) {
      console.error("❌ Initial cleanup failed:", error);
    }
  }, 5_000);
  initialCleanupHandle.unref();

  console.log(
    `⏰ Cleanup jobs scheduled every ${CLEANUP_INTERVAL / 60_000} minutes`,
  );

  // ── Pathway pre-warm (once at startup) ───────────────────────────────────
  // Pre-warming of 'any' locality generic sports is disabled.

  // ── Pathway stale-refresh (periodic) ─────────────────────────────────────
  // Configurable via PATHWAY_REFRESH_INTERVAL_HOURS (default: 24h).
  const pathwayRefreshIntervalHours = parseInt(
    process.env.PATHWAY_REFRESH_INTERVAL_HOURS || "24",
    10,
  );
  const PATHWAY_REFRESH_INTERVAL =
    Math.max(1, pathwayRefreshIntervalHours) * 60 * 60 * 1000;

  const pathwayRefreshHandle = setInterval(async () => {
    try {
      await refreshStalePathways();
    } catch (error) {
      console.error("❌ Pathway stale refresh job failed:", error);
    }
  }, PATHWAY_REFRESH_INTERVAL);
  pathwayRefreshHandle.unref();

  console.log(
    `⏰ Pathway scraper: pre-warm at startup + stale refresh every ${pathwayRefreshIntervalHours}h`,
  );
};
