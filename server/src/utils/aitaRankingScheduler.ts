import cron, { ScheduledTask } from "node-cron";
import { bootFact } from "./boot";
import { AitaRankingIngestService } from "../shared/services/aita/AitaRankingIngestService";
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
 *   • Hourly, a one-request tripwire — a ~3 KB JSON week list, no list fetched.
 *   • When it trips, a full sweep of all twelve lists.
 *   • Once something publishes, back off until 00:00 next Monday.
 *
 * Best case that is a handful of requests a week; worst case ~168 tiny ones.
 * Either way the list is live within an hour of upload. The August 2026 platform
 * cutover made the tripwire cheaper and broader at once: the week list is global
 * rather than per combination, so one call now speaks for all twelve lists
 * instead of Boys U-18 standing in for the rest.
 *
 * A separate weekly sweep runs on Thursday regardless. It exists for the two
 * things the tripwire cannot see: lists that publish without the newest week
 * changing, and silently corrected re-uploads under a week we already hold.
 * That second one got more expensive at the cutover — the old flow could HEAD a
 * static PDF and compare validators, but these pages are generated per request,
 * so detecting a correction now means fetching and hashing. The Thursday sweep
 * is where that cost is paid.
 *
 * ── The detection gap this scheduler used to have ─────────────────────────────
 * When AITA moved platforms, every route the client called began returning 404,
 * and the pipeline reported "up to date" every hour for three weeks. Staleness
 * was the only alarm, and it was the wrong measurement twice over: its threshold
 * was 21 days, and what it measured was the age of the newest list rather than
 * whether we were behind the source. Since AITA's own upload lag runs to 19 days,
 * it would have fired on a perfectly healthy pipeline before it fired on a broken
 * one.
 *
 * Three things replaced it, in order of how fast they speak:
 *
 *   • **~3 hours** — the source layer throws instead of returning emptiness, and
 *     `SOURCE_FAILURE_ALERT_THRESHOLD` consecutive failed tripwires raise an
 *     error. This is the one that matters most: the parser can always be
 *     rewritten, but only if someone knows to rewrite it.
 *   • **~1 day** — the daily health job compares what we hold against the
 *     source's own newest week, so "AITA has a list we do not" is the alarm
 *     rather than "our newest list is old". It warns on the first sighting and
 *     escalates to an error on the second.
 *   • **35 days** — a date ceiling, consulted only when the source cannot be
 *     read at all.
 */

const TIMEZONE = "Asia/Kolkata";

/**
 * Consecutive failed tripwires before this is treated as the source being
 * broken rather than a bad hour.
 *
 * Three, because the tripwire runs hourly and AITA's box does occasionally
 * time out — one failure is noise, three in a row is a fact. Set against the
 * alternative it replaces: a 21-day staleness threshold.
 */
const SOURCE_FAILURE_ALERT_THRESHOLD = 3;

let pollJob: ScheduledTask | null = null;
let sweepJob: ScheduledTask | null = null;
let healthJob: ScheduledTask | null = null;

/** Set after a successful publish; suppresses the tripwire until next Monday. */
let suppressPollUntil: Date | null = null;
/** A sweep runs minutes, not hours, but overlapping runs would double-fetch. */
let running = false;
/** Reset by any tripwire that reaches the source, however boring its answer. */
let consecutiveSourceFailures = 0;
/** So a persistent outage logs one error per escalation, not one per hour. */
let alertedAtFailureCount = 0;
/**
 * Daily health runs that found us behind the source, consecutively.
 *
 * This is the grace the ingest service cannot provide. It can only compare two
 * as-on dates, and since AITA publishes weekly that gap is always at least a week
 * the moment a new list appears — so a duration threshold there would either
 * never fire or never protect. Counting *checks* instead measures the thing that
 * matters: has the hourly poll had a full day to close the gap and failed?
 *
 * One run behind is a warning (the week may have appeared minutes ago). Two is an
 * error: twenty-four hourly polls went by.
 */
let consecutiveBehindChecks = 0;

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
        let probe: Awaited<ReturnType<typeof service.pollSentinel>>;
        try {
          probe = await service.pollSentinel();
        } catch (error) {
          noteSourceFailure(error);
          // Rethrown so runGuarded logs it with the rest of the context; the
          // counter above is what turns a run of these into an alert.
          throw error;
        }
        noteSourceReachable();

        const { hasNewWork, sourceLatest, storedLatest } = probe;
        if (!hasNewWork) return;

        log.info(
          `[aita-rankings] source moved to ${sourceLatest} (had ${storedLatest ?? "nothing"}) — sweeping`
        );
        const report = await service.sweepLiveCombos();
        if (report.published > 0) {
          suppressPollUntil = nextMondayMidnight();
          log.info(
            `[aita-rankings] published ${report.published} list(s); ` +
              `next poll window opens ${suppressPollUntil.toISOString()}`
          );
        }
        if (report.quarantined > 0 || report.failed > 0) {
          log.warn(
            `[aita-rankings] ${report.quarantined} quarantined, ${report.failed} failed — review needed`
          );
        }
      });
    },
    { timezone: TIMEZONE }
  );

  // Thursday 03:00 IST — the backstop the tripwire cannot cover.
  sweepJob = cron.schedule(
    "0 3 * * 4",
    async () => {
      await runGuarded("weekly-sweep", async () => {
        const report = await service.sweepLiveCombos();
        log.info(
          `[aita-rankings] weekly sweep: ${report.published} published, ` +
            `${report.quarantined} quarantined, ${report.failed} failed`
        );
      });
    },
    { timezone: TIMEZONE }
  );

  // Daily 09:00 IST. The real failure mode is silence, not an exception.
  healthJob = cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        // The one caller that asks for the source comparison. It costs a single
        // ~3 KB JSON call once a day, and it is the difference between an alarm
        // that means "we are behind" and one that means "AITA has been slow" —
        // the old version fired on the latter and would have cried wolf on a
        // perfectly current pipeline.
        const health = await service.getHealth({ checkSource: true });

        if (health.behindSource === true) {
          consecutiveBehindChecks += 1;
          const message =
            `[aita-rankings] ${health.staleReason}. ` +
            `Check https://www.aita.hitcourt.com/ranking before assuming a code fault.`;
          // First sighting may simply be a week that landed minutes ago; the
          // hourly poll gets it within the hour. A second sighting means a full
          // day of polls went by without closing the gap.
          if (consecutiveBehindChecks >= 2) log.error(message);
          else log.warn(`${message} (first daily check — will escalate if it persists)`);
        } else {
          if (consecutiveBehindChecks > 0) {
            log.info(`[aita-rankings] caught up with the source at ${health.latestAsOnDate}`);
          }
          consecutiveBehindChecks = 0;
          // Only meaningful when the source could not be read at all — when we
          // know we match it, the age of the newest list is AITA's lag, not ours.
          if (health.stale) {
            log.error(`[aita-rankings] STALE — ${health.staleReason ?? "reason unrecorded"}.`);
          }
        }
        if (health.quarantinedCount > 0) {
          log.warn(`[aita-rankings] ${health.quarantinedCount} snapshot(s) awaiting review`);
        }
        // Staleness answers "are we behind?"; this answers "can we still reach
        // them?". Reported together because the pair distinguishes a quiet week
        // upstream from a source we have lost.
        if (consecutiveSourceFailures > 0) {
          log.warn(
            `[aita-rankings] ${consecutiveSourceFailures} consecutive tripwire ` +
              `failure(s) since the last successful check`
          );
        }
      } catch (error) {
        log.error("[aita-rankings] health check failed:", error);
      }
    },
    { timezone: TIMEZONE }
  );

  bootFact("jobs", "aita hourly + Thu sweep");
  return { pollJob, sweepJob, healthJob };
}

export function stopAitaRankingScheduler(): void {
  pollJob?.stop();
  sweepJob?.stop();
  healthJob?.stop();
  pollJob = sweepJob = healthJob = null;
  // Otherwise a restart inherits a stale failure run and either alerts on the
  // first hiccup or, worse, suppresses the alert it should have raised.
  consecutiveSourceFailures = 0;
  alertedAtFailureCount = 0;
  consecutiveBehindChecks = 0;
  suppressPollUntil = null;
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

/**
 * Records that the tripwire could not reach the source, and escalates once the
 * run of failures is long enough to be a fact rather than a bad hour.
 *
 * The message names the likely cause on purpose. When this fires, the person
 * reading it needs to know to go and look at the site, not to restart the
 * process — the last time this happened the site had moved to a new platform.
 */
function noteSourceFailure(error: unknown): void {
  consecutiveSourceFailures++;
  if (consecutiveSourceFailures < SOURCE_FAILURE_ALERT_THRESHOLD) return;

  // Escalate at the threshold, then again at each doubling, so a multi-day
  // outage stays visible without writing an error every hour for days.
  const shouldAlert =
    alertedAtFailureCount === 0 || consecutiveSourceFailures >= alertedAtFailureCount * 2;
  if (!shouldAlert) return;

  alertedAtFailureCount = consecutiveSourceFailures;
  log.error(
    `[aita-rankings] SOURCE UNREACHABLE — ${consecutiveSourceFailures} consecutive ` +
      `failed tripwires. AITA's routes may have moved or started requiring a ` +
      `session; check https://www.aita.hitcourt.com/ranking before assuming an ` +
      `outage. Last error: ${error instanceof Error ? error.message : String(error)}`
  );
}

/** Clears the failure run. A boring "nothing new" still counts as reachable. */
function noteSourceReachable(): void {
  if (consecutiveSourceFailures >= SOURCE_FAILURE_ALERT_THRESHOLD) {
    log.info(
      `[aita-rankings] source reachable again after ` +
        `${consecutiveSourceFailures} failed tripwires`
    );
  }
  consecutiveSourceFailures = 0;
  alertedAtFailureCount = 0;
}

/** Exposed so the health endpoint can report it alongside staleness. */
export function getSourceFailureStreak(): number {
  return consecutiveSourceFailures;
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
    nowIst.getUTCDate() + daysUntilMonday
  );
  return new Date(mondayIst - IST_OFFSET_MS);
}
