/**
 * Bring the stored tennis editions in line with AITA's live tournament calendar.
 *
 *   Report only (writes nothing):
 *     npx ts-node src/scripts/ingestAitaCalendar.ts
 *   Write:
 *     npx ts-node src/scripts/ingestAitaCalendar.ts --apply --backup <file.json>
 *
 * Options: --months N (default 5, from this month), --sheet-days N (default 120:
 * fact sheets are read for ladder events starting within that many days).
 * (Not `npm run x -- --apply`: PowerShell strips the `--` and it silently reports.)
 *
 * This is the same sweep the scheduler runs (shared/services/aita/AitaCalendarSyncService.ts),
 * so what is reported here is what the schedule would do. Decided in
 * docs/planner-aita-calendar-plan.md:
 *   - UPDATES a stored row in place when it is the same event (keeping its name and
 *     slug), CREATES a row for every junior event AITA lists that we do not hold, and
 *     CANCELS an event of ours that AITA has stopped listing, but only after it has
 *     gone unseen for 10 days and never on a sweep that looks broken.
 *   - Never deletes, and never touches a row the older calendar made unless AITA's
 *     calendar matches it.
 *   - `--apply` refuses to run without `--backup`, and the backup is written, and
 *     read back, before the first write.
 *
 * There is ONE database and it is production (server/CLAUDE.md), so this uses the raw
 * driver and imports no Mongoose model: loading a model locally creates its
 * collection and indexes in production, and a report run must not do even that.
 */

import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { syncAitaCalendar } from "../shared/services/aita/AitaCalendarSyncService";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const argValue = (flag: string): string | undefined => {
  const at = process.argv.indexOf(flag);
  return at === -1 ? undefined : process.argv[at + 1];
};
const APPLY = process.argv.includes("--apply");
const BACKUP = argValue("--backup");
const MONTHS = Number(argValue("--months")) || 5;
const SHEET_DAYS = Number(argValue("--sheet-days") ?? 120);

async function main(): Promise<void> {
  if (APPLY && !BACKUP) {
    console.error(
      "--apply needs --backup <file.json>: the rows about to be changed are saved there first."
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db!;

  console.log("Reading AITA (about 3 minutes: one request every 1.5 seconds)...");
  const report = await syncAitaCalendar(
    { db },
    {
      apply: APPLY,
      months: MONTHS,
      sheetDays: SHEET_DAYS,
      backup: (rows) => {
        fs.writeFileSync(
          BACKUP!,
          JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 1)
        );
        const reread = JSON.parse(fs.readFileSync(BACKUP!, "utf8")) as { rows: unknown[] };
        if (reread.rows.length !== rows.length)
          throw new Error("The backup did not read back complete.");
        console.log(`Backed up ${rows.length} rows to ${BACKUP}`);
      },
    }
  );
  await mongoose.disconnect();

  const { plan, retirements } = report;
  for (const m of report.monthsRead) console.log(`AITA ${m.month}: ${m.events} events`);

  const written = [...plan.creates.map((c) => c.doc), ...plan.updates.map((u) => u.set)];
  const count = (source: string | undefined): number =>
    written.filter((d) => d.officialDetailsSource === source).length;
  console.log(`\n── Plan (${report.applied ? "WRITTEN" : "report only"}) ──`);
  console.log(
    `Update in place:   ${plan.updates.length}  (${plan.updates.filter((u) => u.matchedBy === "externalId").length} by AITA id, ${plan.updates.filter((u) => u.matchedBy === "legacy").length} matched to an old row)`
  );
  console.log(`Create:            ${plan.creates.length}`);
  console.log(
    `Cancel (gone from AITA, unseen 10+ days): ${retirements.cancel.length}; missing but still being watched: ${retirements.watching.length}`
  );
  console.log(`Skipped:           ${plan.skipped.length}`);
  console.log(`Out of scope:      ${JSON.stringify(plan.outOfScope)}`);
  console.log(
    `Official details from fact sheet / rules only / none (international events): ${count("factSheet")} / ${count("rules")} / ${count(undefined)}`
  );
  console.log(`Fact sheets read: ${report.sheetsRead}, unreadable: ${report.sheetFailures.length}`);
  console.log(`Stored junior rows no AITA event matched (left alone): ${plan.unmatched.length}`);
  if (retirements.refused) console.log(`\nREFUSED to write: ${retirements.refused}`);

  console.log("\nUpdates:");
  for (const u of plan.updates) {
    console.log(
      `  ${u.name.padEnd(36)} ${u.was.startDate} -> ${u.set.startDate.toISOString().slice(0, 10)}  [${u.externalId}, ${u.matchedBy}]${u.set.status ? "  RESTORED" : ""}`
    );
  }
  console.log("\nCreates:");
  for (const c of plan.creates) {
    const d = c.doc;
    console.log(
      `  ${d.startDate.toISOString().slice(0, 10)}  ${d.name.padEnd(40)} ${d.ageGroups.join("/").padEnd(18)} ${d.officialDetailsSource ?? "-"}  ${d.slug}`
    );
  }
  if (retirements.cancel.length || retirements.watching.length) {
    console.log("\nNo longer on AITA's calendar:");
    for (const s of retirements.cancel)
      console.log(`  CANCEL  ${s.startDate.toISOString().slice(0, 10)}  ${s.name}`);
    for (const s of retirements.watching)
      console.log(`  watch   ${s.startDate.toISOString().slice(0, 10)}  ${s.name}`);
  }
  if (plan.skipped.length) {
    console.log("\nSkipped:");
    for (const s of plan.skipped) console.log(`  [${s.externalId}] ${s.name}: ${s.reason}`);
  }
  if (plan.warnings.length) {
    console.log("\nSheet vs rules disagreements:");
    for (const w of plan.warnings) console.log("  " + w);
  }
  if (report.sheetFailures.length) {
    console.log("\nFact sheets not read:");
    for (const f of report.sheetFailures) console.log("  " + f);
  }
  if (plan.unmatched.length) {
    console.log("\nStored, not matched, left alone:");
    for (const s of plan.unmatched) {
      console.log(
        `  ${s.startDate.toISOString().slice(0, 10)}  ${s.name}  (${s.slug ?? "no slug"})`
      );
    }
  }

  if (!report.applied) {
    console.log("\nNothing was written. Re-run with --apply --backup <file> to write.");
    return;
  }
  const w = report.written;
  console.log(
    `\nUpdated ${w.updated}, created ${w.created}, cancelled ${w.cancelled}, failed ${w.failed.length}.`
  );
  for (const f of w.failed) console.log("  " + f);
  console.log("Pages cache for about five minutes; nothing else to do.");
  if (w.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("failed:", error instanceof Error ? error.message.slice(0, 300) : error);
  process.exit(1);
});
