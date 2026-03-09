import cron, { ScheduledTask } from "node-cron";
import { ScheduledNotificationService } from "../services/ScheduledNotificationService";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";
import {
  broadcastStatsUpdate,
  broadcastHealthUpdate,
} from "../sockets/notificationSocket";

// Flag to prevent duplicate job execution
let isProcessing = false;

/**
 * Initialize the reminder scheduler
 * Runs every minute to check for and process pending reminders
 */
export function initializeReminderScheduler() {
  console.log("📅 Initializing reminder scheduler...");

  // Run every minute (cron expression: "* * * * *")
  // For production, you might want to run every 5 minutes: "*/5 * * * *"
  const job = cron.schedule(
    "* * * * *",
    async () => {
      // Prevent overlapping executions
      if (isProcessing) {
        console.log(
          "⏭️  Skipping reminder processing - previous job still running",
        );
        return;
      }

      try {
        isProcessing = true;
        const timestamp = new Date().toISOString();
        console.log(`\n🔔 [${timestamp}] Processing pending reminders...`);

        // Record processing run for monitoring
        ReminderMonitoringService.recordProcessingRun();

        const stats =
          await ScheduledNotificationService.processPendingReminders(100);

        if (stats.processed > 0) {
          console.log(
            `✅ [${timestamp}] Processed ${stats.processed} reminders: ` +
              `${stats.sent} sent, ${stats.failed} failed`,
          );
        } else {
          console.log(`ℹ️  [${timestamp}] No pending reminders to process`);
        }

        // Broadcast updated stats via WebSocket
        await broadcastStatsUpdate();
      } catch (error) {
        console.error("❌ Error processing reminders:", error);
      } finally {
        isProcessing = false;
      }
    },
    {
      timezone: "Asia/Kolkata", // Adjust to your timezone
    },
  );

  // Schedule health check every 10 minutes
  cron.schedule(
    "*/10 * * * *",
    async () => {
      try {
        await ReminderMonitoringService.performHealthCheck();

        // Broadcast updated health status via WebSocket
        await broadcastHealthUpdate();
      } catch (error) {
        console.error("❌ Error in health check:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("✅ Health monitoring initialized (runs every 10 minutes)");

  // Schedule daily summary at 9:00 AM
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        console.log("📊 Sending daily reminder system summary...");
        await ReminderMonitoringService.sendDailySummary();
      } catch (error) {
        console.error("❌ Error sending daily summary:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("✅ Daily summary scheduled (9:00 AM IST)");

  //
  console.log("✅ Reminder scheduler initialized (runs every minute)");

  // Return the job so it can be stopped if needed
  return job;
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(job: ScheduledTask) {
  console.log("🛑 Stopping reminder scheduler...");
  job.stop();
  console.log("✅ Reminder scheduler stopped");
}
