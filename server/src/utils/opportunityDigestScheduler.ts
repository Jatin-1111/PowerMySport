import cron, { ScheduledTask } from "node-cron";

import { runDeadlineDigest } from "../admin/services/opportunityDeadlines";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("opportunityDeadlines");

/**
 * The weekly email about dates and checks on admissions and scholarships (see
 * opportunityDeadlines.ts): windows about to open or close, and entries due a
 * check. Monday 07:30 IST, after the source check's digest at 05:00, so the two
 * arrive together at the start of the working week. It sends nothing in a week
 * with nothing to say.
 *
 * ── Why this one is OFF unless it is the deployed server ────────────────────
 * It emails every editor, and a local server runs every scheduler against the one
 * production database. So, as for the AITA calendar job, it runs only when
 * `NODE_ENV` is "production", or when `OPPORTUNITY_DIGEST_CRON=on` asks for it.
 * `OPPORTUNITY_DIGEST_CRON_DISABLED=true` turns it off even then.
 */
const cronExpression = process.env.OPPORTUNITY_DIGEST_CRON_EXPR || "30 7 * * 1";

export function initializeOpportunityDigestScheduler(): ScheduledTask | null {
  const wanted =
    process.env.NODE_ENV === "production" || process.env.OPPORTUNITY_DIGEST_CRON === "on";
  if (!wanted || process.env.OPPORTUNITY_DIGEST_CRON_DISABLED === "true") {
    bootFact("jobs", "opportunity-deadlines off");
    return null;
  }

  const job = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runDeadlineDigest();
      } catch (error) {
        log.error("Deadline digest failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `opportunity-deadlines ${cronExpression}`);
  return job;
}
