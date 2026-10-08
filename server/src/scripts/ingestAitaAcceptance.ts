/* eslint-disable no-console */
/**
 * Capture who got into finished AITA junior events, as anonymous numbers.
 *
 *   node dist/scripts/ingestAitaAcceptance.js [options]
 *
 *   --months <n>    How many months back to look for finished events (default 12).
 *   --limit <n>     At most this many events per run (default 40).
 *   --since <date>  Ignore events that ended before this day (default: 120 days ago).
 *   --no-db         Touch no database. Nothing is skipped as "already captured"; combine
 *                   with --out to keep what was read.
 *   --out <file>    Write the records as JSON (works with or without --no-db).
 *   --apply         Save to the database. Without it, a run only reports its plan.
 *
 * With no flags it reads the calendar pages (public), reads which events are already
 * stored (one `distinct`), and prints what it WOULD fetch. Nothing is written without
 * --apply.
 *
 * This repo runs scripts against the production database, and importing a model while
 * autoIndex is on creates its collection and indexes there. So the model is loaded only
 * when the database is actually used, never for --no-db.
 */
import fs = require("fs");
import path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

import { AitaAcceptanceSource } from "../shared/services/aita/AitaAcceptanceSource";
import {
  captureAcceptance,
  selectTargets,
  type AcceptanceRecord,
  type CaptureTarget,
} from "../shared/services/aita/acceptanceCapture";
import { AitaCalendarSource } from "../shared/services/aita/AitaCalendarSource";

const flag = (name: string): boolean => process.argv.includes(name);
const value = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main(): Promise<void> {
  const months = Math.max(1, Number(value("--months") ?? 12));
  const limit = Math.max(1, Number(value("--limit") ?? 40));
  const since =
    value("--since") ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const noDb = flag("--no-db");
  const apply = flag("--apply");
  const outFile = value("--out");
  if (noDb && apply)
    throw new Error("--apply saves to the database, so it cannot be used with --no-db");

  const today = new Date().toISOString().slice(0, 10);
  const calendar = new AitaCalendarSource();

  const rows: CaptureTarget[] = [];
  const cursor = new Date();
  for (let back = 0; back <= months; back += 1) {
    const month = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - back, 1));
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
    console.log(`${month.toISOString().slice(0, 7)}: ${found.length} events`);
  }

  let mongoose: typeof import("mongoose") | null = null;
  let already = new Set<string>();
  let save = async (_records: AcceptanceRecord[]): Promise<void> => {};
  const kept: AcceptanceRecord[] = [];

  if (!noDb) {
    mongoose = (await import("mongoose")).default as unknown as typeof import("mongoose");
    await mongoose.connect(process.env.MONGO_URI ?? "");
    const store = await import("../shared/services/aita/acceptanceStore");
    already = await store.capturedIds();
    if (apply) save = store.saveRecords;
  }

  const targets = selectTargets(rows, { today, alreadyCaptured: already, limit, since });
  console.log(
    `${targets.length} finished junior events to capture (${already.size} already held).`
  );
  if (!apply && !outFile) {
    for (const target of targets)
      console.log(`  ${target.externalId}  ${target.ladder}  ${target.name}`);
    console.log(
      "Plan only. Use --apply to save to the database, or --out <file> to keep the records."
    );
  } else {
    const report = await captureAcceptance({
      targets,
      source: new AitaAcceptanceSource(),
      save: async (records) => {
        kept.push(...records);
        await save(records);
      },
      now: new Date(),
      log: (line) => console.log(`  ${line}`),
    });
    console.log(
      `Fetched ${report.fetched}, ${report.records} category records, ${report.failed.length} failed.`
    );
    if (outFile) {
      fs.writeFileSync(
        path.resolve(outFile),
        JSON.stringify({ capturedOn: today, records: kept }, null, 2)
      );
      console.log(`Wrote ${kept.length} records to ${path.resolve(outFile)}`);
    }
  }
  if (mongoose) await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
