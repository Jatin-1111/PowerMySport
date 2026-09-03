import cron, { ScheduledTask } from "node-cron";
import { bootFact } from "./boot";
import { ScheduledNotificationService } from "../client/services/ScheduledNotificationService";
import { ReminderMonitoringService } from "../client/services/ReminderMonitoringService";
import { broadcastStatsUpdate, broadcastHealthUpdate } from "../client/sockets/notificationSocket";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("reminder");

// Flag to prevent duplicate job execution
let isProcessing = false;
const verboseSchedulerLogs = process.env.VERBOSE_SCHEDULER_LOGS === "true";

const schedulerCronExpression =
  process.env.REMINDER_PROCESS_CRON ||
  (process.env.NODE_ENV === "production" ? "*/5 * * * *" : "* * * * *");

const healthCronExpression = process.env.REMINDER_HEALTH_CRON || "*/10 * * * *";

const reminderBatchSize = parseInt(process.env.REMINDER_PROCESS_BATCH_SIZE || "100", 10);

/**
 * Initialize the reminder scheduler
 * Runs on configurable cron cadence to process pending reminders
 */
export function initializeReminderScheduler() {
  const job = cron.schedule(
    schedulerCronExpression,
    async () => {
      // Prevent overlapping executions
      if (isProcessing) {
        if (verboseSchedulerLogs) {
          log.info("Skipping reminder processing - previous job still running");
        }
        return;
      }

      try {
        isProcessing = true;
        const timestamp = new Date().toISOString();
        if (verboseSchedulerLogs) log.debug("Processing pending reminders");

        // Record processing run for monitoring
        ReminderMonitoringService.recordProcessingRun();

        const stats = await ScheduledNotificationService.processPendingReminders(reminderBatchSize);

        if (stats.processed > 0) {
          log.info(
            `Processed ${stats.processed} reminder(s): ${stats.sent} sent, ${stats.failed} failed`
          );
        }

        // Broadcast updated stats via WebSocket
        await broadcastStatsUpdate();
      } catch (error) {
        log.error("Error processing reminders:", error);
      } finally {
        isProcessing = false;
      }
    },
    {
      timezone: "Asia/Kolkata", // Adjust to your timezone
    }
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
        log.error("Error in health check:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  bootFact("jobs", `health ${healthCronExpression}`);

  // Schedule daily summary at 9:00 AM
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        log.info("Sending daily reminder system summary...");
        await ReminderMonitoringService.sendDailySummary();
      } catch (error) {
        log.error("Error sending daily summary:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  //
  bootFact("jobs", `reminders ${schedulerCronExpression} x${reminderBatchSize}`);

  // Return the job so it can be stopped if needed
  return job;
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(job: ScheduledTask) {
  log.info("Stopping reminder scheduler...");
  job.stop();
  log.info("Reminder scheduler stopped");
}
