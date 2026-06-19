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

/**
 * Auto-release payments 24 hours after session completion
 * REQUIREMENT 1: Payment should be automatically released after 24hrs of session
 */
export const releaseCompletedBookingPayments = async (): Promise<void> => {
  try {
    const { Booking } = await import("../client/models/Booking");
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find all COMPLETED bookings where:
    // 1. Session status is COMPLETED (session happened)
    // 2. Payment is still PENDING (not yet released)
    // 3. Booking was updated 24+ hours ago
    const completedBookings = await Booking.find({
      status: "COMPLETED",
      updatedAt: { $lte: twentyFourHoursAgo },
      "payments.status": "PENDING",
    });

    let releasedCount = 0;

    for (const booking of completedBookings) {
      // Update all pending payments to PAID with paidAt timestamp
      booking.payments = booking.payments.map((payment: any) => {
        if (payment.status === "PENDING") {
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
 * Runs periodically to check refund completion status
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
 * Run all cleanup tasks
 * Should be scheduled to run every 15-30 minutes
 */
export const runScheduledCleanup = async (): Promise<void> => {
  console.log("🔄 Starting scheduled cleanup tasks...");

  try {
    // Poll refunds (every cleanup cycle)
    await pollPendingRefunds();

    // Release payments for completed bookings (24+ hours old)
    await releaseCompletedBookingPayments();

    // Cleanup expired bookings (not paid within 2 hours)
    const expiredBookingsCount = await cleanupExpiredBookings();
    console.log(`✅ Cancelled ${expiredBookingsCount} expired booking(s)`);

    // Cleanup stale booking locks (past dates)
    const staleLocks = await cleanupStaleBookingLocks();
    console.log(`✅ Cleaned up ${staleLocks} stale booking lock(s)`);

    // Cleanup expired email verification codes and rate limits
    await cleanupExpiredCodes();
    console.log(`✅ Cleaned up expired email verification codes`);

    // Cleanup expired coach subscriptions
    const expiredSubscriptions = await cleanupExpiredCoachSubscriptions();
    console.log(`✅ Expired ${expiredSubscriptions} coach subscription(s)`);

    // Process Shop Waitlist Notifications
    await processWaitlistNotifications();

    console.log("✅ Scheduled cleanup completed successfully");
  } catch (error) {
    console.error("❌ Error during scheduled cleanup:", error);
    throw error;
  }
};

/**
 * Initialize scheduled jobs
 * Call this once when server starts
 */
export const initializeScheduledJobs = (): void => {
  console.log("⏰ Initializing scheduled cleanup jobs...");

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

  // Run initial cleanup on startup
  const initialCleanupTimeoutHandle = setTimeout(async () => {
    try {
      await runScheduledCleanup();
    } catch (error) {
      console.error("❌ Initial cleanup failed:", error);
    }
  }, 5000); // 5 seconds after startup
  initialCleanupTimeoutHandle.unref();

  console.log(
    `⏰ Cleanup jobs scheduled to run every ${CLEANUP_INTERVAL / 60000} minutes`,
  );
};
