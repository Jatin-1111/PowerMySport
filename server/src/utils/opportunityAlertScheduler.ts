import cron, { ScheduledTask } from "node-cron";

import { OpportunityAlertService } from "../shared/services/opportunityAlerts";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("opportunityAlerts");

/**
 * The daily check for windows that parents follow having opened or being about
 * to close (see opportunityAlerts.ts). 09:00 IST: after the weekly editor
 * digests, and early enough that "closes tomorrow" arrives with a day to spare.
 * It sends nothing on a day with nothing to say.
 *
 * ── Why this one is OFF unless it is the deployed server ────────────────────
 * It emails real parents, and a local server runs every scheduler against the
 * one production database. So it runs only when `NODE_ENV` is "production", or
 * when `OPPORTUNITY_ALERTS_CRON=on` asks for it. `OPPORTUNITY_ALERTS_CRON_DISABLED
 * =true` turns it off even then.
 */
const cronExpression = process.env.OPPORTUNITY_ALERTS_CRON_EXPR || "0 9 * * *";

let isRunning = false;

export function initializeOpportunityAlertScheduler(): ScheduledTask | null {
  const wanted =
    process.env.NODE_ENV === "production" || process.env.OPPORTUNITY_ALERTS_CRON === "on";
  if (!wanted || process.env.OPPORTUNITY_ALERTS_CRON_DISABLED === "true") {
    bootFact("jobs", "opportunity-alerts off");
    return null;
  }

  const job = cron.schedule(
    cronExpression,
    async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        await OpportunityAlertService.sweep();
      } catch (error) {
        log.error("Opportunity alert sweep failed:", error);
      } finally {
        isRunning = false;
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `opportunity-alerts ${cronExpression}`);
  return job;
}
