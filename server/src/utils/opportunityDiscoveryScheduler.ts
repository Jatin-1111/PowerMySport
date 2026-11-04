import cron, { ScheduledTask } from "node-cron";

import {
  isDiscoveryRunning,
  runOpportunityDiscovery,
} from "../admin/services/opportunityDiscovery";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("opportunityDiscovery");

/**
 * Monthly AI web search for admission routes and scholarships we do not cover
 * yet (see opportunityDiscovery.ts). Monthly, not weekly: new schemes appear a
 * few times a year, each run spends grounded-search quota, and every lead
 * costs a person a look.
 *
 * `OPPORTUNITY_DISCOVERY_CRON_DISABLED=true` turns it off. Set it on a local
 * server, which runs against the production database.
 */
const cronExpression = process.env.OPPORTUNITY_DISCOVERY_CRON || "0 6 1 * *";

export function initializeOpportunityDiscoveryScheduler(): ScheduledTask | null {
  if (process.env.OPPORTUNITY_DISCOVERY_CRON_DISABLED === "true") {
    bootFact("jobs", "opportunity-discovery disabled");
    return null;
  }

  const job = cron.schedule(
    cronExpression,
    async () => {
      if (isDiscoveryRunning()) {
        log.info("Skipping the search for new leads: one is already running");
        return;
      }
      try {
        await runOpportunityDiscovery();
      } catch (error) {
        log.error("Search for new leads failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `opportunity-discovery ${cronExpression}`);
  return job;
}
