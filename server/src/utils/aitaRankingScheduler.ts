import cron, { ScheduledTask } from "node-cron";
import { bootFact } from "./boot";
import {
  AitaRankingIngestService,
  STALENESS_ALERT_DAYS,
} from "../shared/services/aita/AitaRankingIngestService";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("aitaRanking");

/**
 * Scheduling for the AITA ranking mirror.
 *
 * The shape here comes from what AITA actually does rather than what its data
 * implies. Ranking lists are dated Mondays — 39 of the last 40 snapshots, the
 * exception being a 31-December year-end special — but the *upload* lands
 * whenever someone at AITA gets to it. On 8 August 2026 the newest published
 * list was still dated 27 July, twelve days behind, and the gaps across the
 * history are frequently 14 days rather than 7.
 *
 * So a Monday-only cron would sit idle exactly when the file is not there yet
 * and then wait a full week to notice it arrived on Wednesday. Instead:
 *
 *   • Hourly, a two-request tripwire against one combo (no PDF is fetched).
 *   • When it trips, a full sweep of all twelve live combos.
 *   • Once something publishes, back off until 00:00 next Monday.
 *
 * Best case that is a handful of requests a week; worst case ~168 tiny ones.
 * Either way the list is live within an hour of upload.
 *
 * A separate weekly sweep runs on Thursday regardless. It exists for the two
 * things the tripwire cannot see: combos that publish without the sentinel
 * moving (their snapshot counts differ by a couple of weeks across the
 * history), and silently corrected re-uploads under an as-on date we already
 * hold, which only show up as changed HTTP validators on the PDF itself.
 */

const TIMEZONE = "Asia/Kolkata";

let pollJob: ScheduledTask | null = null;
let sweepJob: ScheduledTask | null = null;
let healthJob: ScheduledTask | null = null;

/** Set after a successful publish; suppresses the tripwire until next Monday. */
let suppressPollUntil: Date | null = null;
/** A sweep runs minutes, not hours, but overlapping runs would double-fetch. */
let running = false;

const service = new AitaRankingIngestService();

export function initializeAitaRankingScheduler(): {
  pollJob: ScheduledTask;
  sweepJob: ScheduledTask;
  healthJob: ScheduledTask;
} | null {
  if (process.env.AITA_RANKINGS_CRON_DISABLED === "true") {
    bootFact("jobs", "aita disabled");
    return null;
  }

  // Every hour, on the hour.
  pollJob = cron.schedule(
    "0 * * * *",
    async () => {
      if (suppressPollUntil && Date.now() < suppressPollUntil.getTime()) return;
      await runGuarded("poll", async () => {
        const { hasNewWork, sourceLatest, storedLatest } = await service.pollSentinel();
        if (!hasNewWork) return;

        log.info(
          `[aita-rankings] source moved to ${sourceLatest} (had ${storedLatest ?? "nothing"}) — sweeping`,
        );
        const report = await service.sweepLiveCombos();
        if (report.published > 0) {
          suppressPollUntil = nextMondayMidnight();
          log.info(
            `[aita-rankings] published ${report.published} list(s); ` +
              `next poll window opens ${suppressPollUntil.toISOString()}`,
          );
        }
        if (report.quarantined > 0 || report.failed > 0) {
          log.warn(
            `[aita-rankings] ${report.quarantined} quarantined, ${report.failed} failed — review needed`,
          );
        }
      });
    },
    { timezone: TIMEZONE },
  );

  // Thursday 03:00 IST — the backstop the tripwire cannot cover.
  sweepJob = cron.schedule(
    "0 3 * * 4",
    async () => {
      await runGuarded("weekly-sweep", async () => {
        const report = await service.sweepLiveCombos();
        log.info(
          `[aita-rankings] weekly sweep: ${report.published} published, ` +
            `${report.quarantined} quarantined, ${report.failed} failed`,
        );
      });
    },
    { timezone: TIMEZONE },
  );

  // Daily 09:00 IST. The real failure mode is silence, not an exception.
  healthJob = cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const health = await service.getHealth();
        if (health.stale) {
          log.error(
            `[aita-rankings] STALE — nothing published for ${health.daysSincePublish ?? "?"} days ` +
              `(latest ${health.latestAsOnDate ?? "none"}, threshold ${STALENESS_ALERT_DAYS}). ` +
              `The source layout or URLs may have changed.`,
          );
        }
        if (health.quarantinedCount > 0) {
          log.warn(
            `[aita-rankings] ${health.quarantinedCount} snapshot(s) awaiting review`,
          );
        }
      } catch (error) {
        log.error("[aita-rankings] health check failed:", error);
      }
    },
    { timezone: TIMEZONE },
  );

  bootFact("jobs", "aita hourly + Thu sweep");
  return { pollJob, sweepJob, healthJob };
}

export function stopAitaRankingScheduler(): void {
  pollJob?.stop();
  sweepJob?.stop();
  healthJob?.stop();
  pollJob = sweepJob = healthJob = null;
}

async function runGuarded(label: string, fn: () => Promise<void>): Promise<void> {
  if (running) {
    log.warn(`[aita-rankings] ${label} skipped — a run is already in progress`);
    return;
  }
  running = true;
  try {
    await fn();
  } catch (error) {
    log.error(`[aita-rankings] ${label} failed:`, error);
  } finally {
    running = false;
  }
}

/** 00:00 IST on the next Monday, expressed as a real instant. */
function nextMondayMidnight(): Date {
  // IST is UTC+5:30 with no DST, so the arithmetic can stay in UTC.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const daysUntilMonday = (8 - nowIst.getUTCDay()) % 7 || 7;
  const mondayIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + daysUntilMonday,
  );
  return new Date(mondayIst - IST_OFFSET_MS);
}
