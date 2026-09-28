import cron, { ScheduledTask } from "node-cron";

import { isWatchRunning, runOpportunityWatch } from "../admin/services/opportunityWatch";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("opportunityWatch");

/**
 * The weekly check of every source an admission or scholarship entry depends
 * on (see opportunityWatch.ts).
 *
 * Weekly because these documents change once a year at most, and a week is
 * well inside the gap between a circular appearing and its deadline. Monday
 * 05:00 IST, so the digest is waiting at the start of the working week.
 *
 * `OPPORTUNITY_WATCH_CRON_DISABLED=true` turns it off, as for the AITA job.
 * Set it in a local server/.env: a local server runs against the production
 * database, and would otherwise check every source and email every editor
 * from a laptop on Monday morning.
 */
const cronExpression = process.env.OPPORTUNITY_WATCH_CRON || "0 5 * * 1";

export function initializeOpportunityWatchScheduler(): ScheduledTask | null {
  if (process.env.OPPORTUNITY_WATCH_CRON_DISABLED === "true") {
    bootFact("jobs", "opportunity-watch disabled");
    return null;
  }

  const job = cron.schedule(
    cronExpression,
    async () => {
      if (isWatchRunning()) {
        log.info("Skipping the source check: one is already running");
        return;
      }
      try {
        await runOpportunityWatch();
      } catch (error) {
        log.error("Source check failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `opportunity-watch ${cronExpression}`);
  return job;
}
