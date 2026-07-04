/**
 * Scheduled jobs for maintenance and cleanup tasks
 * Run periodically via cron or job scheduler
 */

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
    const { Booking } = await import("../client/models/Booking");
    const { BookingPaymentTransaction } = await import("../client/models/BookingPayment");
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
        console.warn(
          `⚠️ Skipping payout release for booking ${booking._id}: no confirmed payment transaction found`,
        );
        continue;
      }

      // Only release payee entries (VENUE_LISTER / COACH).
      // The PLAYER entry is already marked PAID by updatePaymentStatus().
      booking.payments = booking.payments.map((payment: any) => {
        if (payment.status === "PENDING" && payment.userType !== "Player") {
          payment.status = "PAID";
          payment.paidAt = now;
        }
        return payment;
      });

      await booking.save();
      releasedCount++;
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
      } = await import("../client/services/ExpertsService");
      const expiredHolds = await expireUnpaidExpertHolds();
      if (expiredHolds > 0) console.log(`✅ Expired ${expiredHolds} unpaid expert hold(s)`);
      const autoCompleted = await autoCompleteExpertSessions();
      if (autoCompleted > 0) console.log(`✅ Auto-completed ${autoCompleted} expert session(s)`);
      const reminded = await sendExpertReviewReminders();
      if (reminded > 0) console.log(`✅ Sent ${reminded} expert review reminder(s)`);
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
