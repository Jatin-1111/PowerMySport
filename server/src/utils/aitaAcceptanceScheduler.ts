import cron, { ScheduledTask } from "node-cron";

import { AitaAcceptanceSource } from "../shared/services/aita/AitaAcceptanceSource";
import { AitaCalendarSource } from "../shared/services/aita/AitaCalendarSource";
import {
  captureAcceptance,
  selectTargets,
  type AcceptanceRecord,
  type CaptureReport,
  type CaptureTarget,
} from "../shared/services/aita/acceptanceCapture";
import { capturedIds, saveRecords } from "../shared/services/aita/acceptanceStore";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("aitaAcceptance");

/**
 * Twice-weekly capture of who got into finished AITA junior events, as anonymous numbers
 * (see `acceptanceCapture.ts`, and `planner-recommendations-audit.md` for why).
 *
 * Wednesday and Saturday 05:30 IST: the morning after the calendar sweeps (Tuesday and
 * Friday 04:30), so an event that finished at the weekend is read within days. Each run
 * fetches only events that finished since the last, a handful of requests each, spaced
 * 1.5 seconds apart; the first run works through the backlog (40 events) and later ones
 * through a few.
 *
 * ── Why it is OFF unless it is the deployed server ──────────────────────────
 * The same reason as the calendar sweep: there is one database and it is production, and a
 * local server starts every scheduler against it. It runs only when `NODE_ENV` is
 * "production", or when `AITA_ACCEPTANCE_CRON=on` asks for it, and
 * `AITA_ACCEPTANCE_CRON_DISABLED=true` turns it off even then.
 *
 * ── Failing ─────────────────────────────────────────────────────────────────
 * It writes only whole events, so a failed run leaves a clean state and the next run picks
 * up what is missing. A failure is logged, and a second in a row says so.
 */
const cronExpression = process.env.AITA_ACCEPTANCE_CRON || "30 5 * * 3,6";

/** How many months of the calendar are searched for finished events. */
const MONTHS_BACK = 4;
const EVENTS_PER_RUN = 40;
/** Older than this and an event never had a list on the current platform. */
const DAYS_BACK = 120;

let running = false;
let consecutiveFailures = 0;

export interface AcceptanceRunDeps {
  readCalendar: () => Promise<CaptureTarget[]>;
  alreadyCaptured: () => Promise<Set<string>>;
  source: { fetchEvent: AitaAcceptanceSource["fetchEvent"] };
  save: (records: AcceptanceRecord[]) => Promise<void>;
  now: () => Date;
}

const defaultDeps = (): AcceptanceRunDeps => ({
  readCalendar: async () => {
    const calendar = new AitaCalendarSource();
    const rows: CaptureTarget[] = [];
    const today = new Date();
    for (let back = 0; back <= MONTHS_BACK; back += 1) {
      const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
      const { rows: found } = await calendar.fetchMonth(
        month.getUTCFullYear(),
        month.getUTCMonth() + 1
      );
      for (const row of found) {
        rows.push({
          externalId: row.externalId,
          name: row.name,
          levelText: row.levelText,
          startDate: row.startDate,
          endDate: row.endDate,
        });
      }
    }
    return rows;
  },
  alreadyCaptured: capturedIds,
  source: new AitaAcceptanceSource(),
  save: saveRecords,
  now: () => new Date(),
});

export function isAitaAcceptanceCaptureRunning(): boolean {
  return running;
}

/** One scheduled run. Exported so a test or an admin action can drive it. */
export async function runAitaAcceptanceCapture(
  deps: AcceptanceRunDeps = defaultDeps()
): Promise<CaptureReport | null> {
  if (running) {
    log.warn("Skipping the acceptance capture: one is already running");
    return null;
  }
  running = true;
  try {
    const now = deps.now();
    const rows = await deps.readCalendar();
    const targets = selectTargets(rows, {
      today: now.toISOString().slice(0, 10),
      alreadyCaptured: await deps.alreadyCaptured(),
      limit: EVENTS_PER_RUN,
      since: new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    const report = await captureAcceptance({
      targets,
      source: deps.source,
      save: deps.save,
      now,
    });
    consecutiveFailures = 0;
    log.info(
      `AITA acceptance capture: ${targets.length} events due, ${report.fetched} fetched, ` +
        `${report.records} category records saved, ${report.skippedNoRecords} with no list, ` +
        `${report.failed.length} failed`
    );
    for (const failure of report.failed) {
      log.warn(`AITA acceptance: ${failure.externalId} failed: ${failure.reason}`);
    }
    return report;
  } catch (error) {
    consecutiveFailures += 1;
    log.error(
      `AITA acceptance capture failed${consecutiveFailures > 1 ? ` (${consecutiveFailures} in a row)` : ""}; ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  } finally {
    running = false;
  }
}

export function initializeAitaAcceptanceScheduler(): ScheduledTask | null {
  const wanted = process.env.NODE_ENV === "production" || process.env.AITA_ACCEPTANCE_CRON === "on";
  if (!wanted || process.env.AITA_ACCEPTANCE_CRON_DISABLED === "true") {
    bootFact("jobs", "aita-acceptance off");
    return null;
  }

  const job = cron.schedule(cronExpression, () => void runAitaAcceptanceCapture(), {
    timezone: "Asia/Kolkata",
  });
  bootFact("jobs", `aita-acceptance ${cronExpression}`);
  return job;
}
