/**
 * Scheduled jobs for maintenance and cleanup tasks
 * Run periodically via cron or job scheduler
 */

import {
  cleanupExpiredBookings,
  cleanupStaleBookingLocks,
} from "../services/BookingService";
import { cleanupExpiredCodes } from "../services/EmailVerificationService";

/**
 * Run all cleanup tasks
 * Should be scheduled to run every 15-30 minutes
 */
export const runScheduledCleanup = async (): Promise<void> => {
  console.log("🔄 Starting scheduled cleanup tasks...");

  try {
    // Cleanup expired bookings (not paid within 2 hours)
    const expiredBookingsCount = await cleanupExpiredBookings();
    console.log(`✅ Cancelled ${expiredBookingsCount} expired booking(s)`);

    // Cleanup stale booking locks (past dates)
    const staleLocks = await cleanupStaleBookingLocks();
    console.log(`✅ Cleaned up ${staleLocks} stale booking lock(s)`);

    // Cleanup expired email verification codes and rate limits
    await cleanupExpiredCodes();
    console.log(`✅ Cleaned up expired email verification codes`);

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
