import cron, { ScheduledTask } from "node-cron";
import { bootFact } from "./boot";
import { RankingDigestService } from "../client/services/RankingDigestService";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("rankingDigest");

/**
 * When to look for a ranking list nobody has been told about yet.
 *
 * ── Why this is not a weekly job, despite being a "weekly digest" ────────────
 * The digest is weekly because the lists are, not because the clock is. The
 * federation dates its lists to Mondays but uploads them whenever it gets to
 * them: twelve days late is an observed case, a fortnight's gap is common, and
 * `aitaRankingScheduler` exists in the shape it does for exactly this reason.
 *
 * So this runs daily and sends nothing on the days there is nothing new. What
 * makes that safe is `lastNotifiedAsOnDate` on the link: the sweep compares the
 * list's own as-on date against the last one that account was told about, so an
 * empty day costs one query and a busy day sends exactly one email per account
 * however many lists landed at once.
 *
 * 18:00 IST, well after the ingest scheduler's hourly tripwire has had the whole
 * working day to notice an upload, and at an hour when a parent is more likely
 * to read it than a morning send competing with everything else.
 */
const cronExpression = process.env.RANKING_DIGEST_CRON || "0 18 * * *";

let isRunning = false;

export function initializeRankingDigestScheduler(): ScheduledTask {
  const job = cron.schedule(
    cronExpression,
    async () => {
      // The sweep is idempotent, so an overlap would be harmless rather than
      // duplicating mail. Skipped anyway: two sweeps racing on a shared-tier
      // cluster is a cost with no upside.
      if (isRunning) {
        log.info("Skipping ranking digest sweep — previous run still in progress");
        return;
      }
      isRunning = true;
      try {
        const { queued, linksCovered } = await RankingDigestService.sweep();
        if (queued > 0) {
          log.info(
            `Ranking digest sweep queued ${queued} digest(s) across ${linksCovered} link(s)`
          );
        }
      } catch (error) {
        log.error("Ranking digest sweep failed:", error);
      } finally {
        isRunning = false;
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  bootFact("jobs", `ranking-digest ${cronExpression}`);
  return job;
}
