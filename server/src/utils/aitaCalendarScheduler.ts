import cron, { ScheduledTask } from "node-cron";
import mongoose from "mongoose";

import { syncAitaCalendar } from "../shared/services/aita/AitaCalendarSyncService";
import { revalidateTournamentEditions } from "../admin/services/ClientCacheRevalidationService";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("aitaCalendar");

/**
 * Twice-weekly sweep of AITA's tournament calendar into the stored tennis
 * editions (see AitaCalendarSyncService.ts and docs/planner-aita-calendar-plan.md).
 *
 * Tuesday and Friday 04:30 IST. AITA publishes two to three months ahead and
 * entries open about three weeks before an event, so a sweep every few days keeps
 * the planner within days of the source, while a sweep is ~100 polite requests (five
 * month pages and a fact sheet per ladder event) and nothing needs it daily.
 *
 * ── Why this one is OFF unless it is the deployed server ────────────────────
 * There is one database and it is production, and a local server starts every
 * scheduler against it (the 2026-08-29 incident was a dev-server cron ingesting to
 * prod). The other jobs here switch OFF with a `*_CRON_DISABLED` variable set in a
 * local .env. This one writes event dates and can cancel events a parent has
 * planned around, so it inverts that: it runs only when `NODE_ENV` is "production",
 * or when `AITA_CALENDAR_CRON=on` asks for it. `AITA_CALENDAR_CRON_DISABLED=true`
 * turns it off even then.
 *
 * ── Failing ─────────────────────────────────────────────────────────────────
 * A sweep that cannot read AITA, or that looks wrong (the sync service refuses
 * rather than cancel events on a half-read calendar), writes nothing and raises an
 * error. Because it runs twice a week, each failure is worth reading, so none is
 * rate-limited; a second consecutive failure says so.
 */
const cronExpression = process.env.AITA_CALENDAR_CRON || "30 4 * * 2,5";

let running = false;
let consecutiveFailures = 0;

export function isAitaCalendarSweepRunning(): boolean {
  return running;
}

/** One scheduled sweep. Exported so a test or an admin action can drive it. */
export async function runAitaCalendarSweep(): Promise<void> {
  if (running) {
    log.warn("Skipping the calendar sweep: one is already running");
    return;
  }
  running = true;
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("the database connection is not open");

    const report = await syncAitaCalendar(
      { db },
      { apply: true, onWritten: revalidateTournamentEditions }
    );

    consecutiveFailures = 0;
    const { updated, created, cancelled, failed } = report.written;
    log.info(
      `AITA calendar sweep: ${report.monthsRead.map((m) => `${m.month}=${m.events}`).join(" ")}; ` +
        `${updated} updated, ${created} created, ${cancelled} cancelled, ${failed.length} failed; ` +
        `${report.sheetsRead} fact sheets read, ${report.sheetFailures.length} unreadable; ` +
        `${report.retirements.watching.length} missing and being watched`
    );
    for (const w of report.plan.warnings) log.warn(`AITA calendar: ${w}`);
    for (const s of report.plan.skipped)
      log.warn(`AITA calendar: skipped [${s.externalId}] ${s.name}: ${s.reason}`);
    for (const f of failed) log.error(`AITA calendar: ${f}`);
    if (report.retirements.cancel.length > 0) {
      log.warn(
        `AITA calendar: cancelled ${report.retirements.cancel.length} event(s) no longer listed: ` +
          report.retirements.cancel.map((s) => s.name).join(", ")
      );
    }
  } catch (error) {
    consecutiveFailures += 1;
    log.error(
      `AITA calendar sweep failed${consecutiveFailures > 1 ? ` (${consecutiveFailures} in a row)` : ""}; ` +
        `nothing was written. Check https://www.aita.hitcourt.com/tournament-calendar-2026 before ` +
        `assuming a code fault. ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    running = false;
  }
}

export function initializeAitaCalendarScheduler(): ScheduledTask | null {
  const wanted = process.env.NODE_ENV === "production" || process.env.AITA_CALENDAR_CRON === "on";
  if (!wanted || process.env.AITA_CALENDAR_CRON_DISABLED === "true") {
    bootFact("jobs", "aita-calendar off");
    return null;
  }

  const job = cron.schedule(cronExpression, () => void runAitaCalendarSweep(), {
    timezone: "Asia/Kolkata",
  });
  bootFact("jobs", `aita-calendar ${cronExpression}`);
  return job;
}
