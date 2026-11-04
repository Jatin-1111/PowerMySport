import cron, { ScheduledTask } from "node-cron";
import { bootFact } from "./boot";
import { ExperienceNudgeService } from "../client/services/ExperienceNudgeService";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("experienceNudge");

// Once a day is enough: the sweep looks back at a whole calendar day of
// completions at once, so running it more often would only mean more empty
// runs, not faster delivery. 11:00 IST — after the late-evening sessions from
// two days ago have long since been marked COMPLETED, comfortably outside
// anyone's typical sleep hours in case push ever gets turned on for this.
const cronExpression = process.env.EXPERIENCE_NUDGE_CRON || "0 11 * * *";
const daysAfter = parseInt(process.env.EXPERIENCE_NUDGE_DAYS_AFTER || "2", 10);

let isRunning = false;

/**
 * "The nudge is what actually fills this — the button will not."
 *
 * Creates ScheduledNotification rows; delivery reuses the existing
 * reminder-processing sweep (initializeReminderScheduler), which already
 * runs every minute in dev / every 5 in production and treats any due,
 * PENDING ScheduledNotification the same regardless of which job created it.
 * This scheduler's only job is to decide, once a day, who gets nudged.
 */
export function initializeExperienceNudgeScheduler(): ScheduledTask {
  const job = cron.schedule(
    cronExpression,
    async () => {
      if (isRunning) {
        log.info("Skipping experience nudge sweep — previous run still in progress");
        return;
      }
      isRunning = true;
      try {
        const { created } = await ExperienceNudgeService.sweep(daysAfter);
        if (created > 0) {
          log.info(`Experience nudge sweep created ${created} notification(s)`);
        }
      } catch (error) {
        log.error("Experience nudge sweep failed:", error);
      } finally {
        isRunning = false;
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `experience-nudge ${cronExpression}`);
  return job;
}
