import cron, { ScheduledTask } from "node-cron";
import { ScheduledNotificationService } from "../services/ScheduledNotificationService";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";
import {
  broadcastStatsUpdate,
  broadcastHealthUpdate,
} from "../sockets/notificationSocket";

// Flag to prevent duplicate job execution
let isProcessing = false;
const verboseSchedulerLogs = process.env.VERBOSE_SCHEDULER_LOGS === "true";

const schedulerCronExpression =
  process.env.REMINDER_PROCESS_CRON ||
  (process.env.NODE_ENV === "production" ? "*/5 * * * *" : "* * * * *");

const healthCronExpression = process.env.REMINDER_HEALTH_CRON || "*/10 * * * *";

const reminderBatchSize = parseInt(
  process.env.REMINDER_PROCESS_BATCH_SIZE || "100",
  10,
);

/**
 * Initialize the reminder scheduler
 * Runs on configurable cron cadence to process pending reminders
 */
export function initializeReminderScheduler() {
  console.log("📅 Initializing reminder scheduler...");

  const job = cron.schedule(
    schedulerCronExpression,
    async () => {
      // Prevent overlapping executions
      if (isProcessing) {
        if (verboseSchedulerLogs) {
          console.log(
            "⏭️  Skipping reminder processing - previous job still running",
          );
        }
        return;
      }

      try {
        isProcessing = true;
        const timestamp = new Date().toISOString();
        if (verboseSchedulerLogs) {
          console.log(`\n🔔 [${timestamp}] Processing pending reminders...`);
        }

        // Record processing run for monitoring
        ReminderMonitoringService.recordProcessingRun();

        const stats =
          await ScheduledNotificationService.processPendingReminders(
            reminderBatchSize,
          );

        if (stats.processed > 0) {
          console.log(
            `✅ [${timestamp}] Processed ${stats.processed} reminders: ` +
              `${stats.sent} sent, ${stats.failed} failed`,
          );
        } else if (verboseSchedulerLogs) {
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
    healthCronExpression,
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

  console.log(
    `✅ Health monitoring initialized (cron: ${healthCronExpression})`,
  );

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
  console.log(
    `✅ Reminder scheduler initialized (cron: ${schedulerCronExpression}, batch: ${reminderBatchSize})`,
  );

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
