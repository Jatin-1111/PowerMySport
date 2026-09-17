import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";
import { seriesFromEditionName, type EditionSeries } from "../shared/services/aita/editionSeries";

/**
 * Migration 45: record which rung of the circuit each tennis edition sits on.
 *
 * The approval path classifies new editions from now on; this is the same
 * classification applied to the 279 tennis rows already on the calendar.
 *
 * ── Why this is safe to run on a full cluster ───────────────────────────────
 * It writes four short fields to at most 279 documents and creates no index.
 * Measured against the incident of 2026-09-17, that is on the order of tens of
 * kilobytes against a 512MB cap — but it is still a write, so it must run after
 * the prune, not before.
 *
 * ── Tennis only ────────────────────────────────────────────────────────────
 * The vocabulary being read is AITA's. Over the chess calendar (557 editions,
 * the largest we hold) a rule like `\bCS\b` could match something that means
 * nothing of the sort, and a wrong ladder is worse than an absent one. Other
 * sports keep these fields unset until someone writes the parser for them.
 *
 * ── What "unknown" means here ──────────────────────────────────────────────
 * It is a result, not a failure. On the current data exactly one edition is
 * unclassifiable — a bare "AITA" with no series in the name — and the right
 * outcome is to record that we do not know rather than to guess a rung.
 *
 * USAGE
 *   npx ts-node src/migrations/45_classify_tennis_edition_series.ts
 *   npx ts-node src/migrations/45_classify_tennis_edition_series.ts --apply
 *   npx ts-node src/migrations/45_classify_tennis_edition_series.ts --down --apply
 *
 * Not `npm run migrate:... -- --apply`: PowerShell eats the first bare `--`,
 * npm takes the flag for itself, and this reports a dry run having changed
 * nothing.
 */

interface Options {
  apply?: boolean;
}

const SPORT = "tennis";

const sameSeries = (
  row: { ladder?: string; grade?: number; circuit?: string; kind?: string },
  series: EditionSeries
): boolean =>
  (row.ladder ?? null) === series.ladder &&
  (row.grade ?? null) === series.grade &&
  (row.circuit ?? null) === series.circuit &&
  (row.kind ?? null) === series.kind;

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Migration 45: classify tennis edition series (${apply ? "APPLY" : "DRY RUN"})`);

  const rows = await TournamentEdition.find({ sportSlug: SPORT })
    .select("name officialName ladder grade circuit kind")
    .lean();
  console.log(`  ${rows.length} tennis editions\n`);

  const counts = new Map<string, number>();
  const unclassified: string[] = [];
  const operations = [];

  for (const row of rows) {
    const series = seriesFromEditionName(row.name, row.officialName);
    counts.set(series.kind, (counts.get(series.kind) ?? 0) + 1);
    if (series.kind === "unknown") unclassified.push(row.name);

    // Idempotent: a re-run after a parser change rewrites only what moved.
    if (sameSeries(row, series)) continue;

    operations.push({
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            ladder: series.ladder,
            grade: series.grade,
            circuit: series.circuit,
            kind: series.kind,
          },
        },
      },
    });
  }

  for (const [kind, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind.padEnd(22)} ${String(count).padStart(4)}`);
  }
  if (unclassified.length > 0) {
    console.log(`\n  unclassified (${unclassified.length}), left unset:`);
    for (const name of unclassified.slice(0, 20)) console.log(`    ${name}`);
  }

  console.log(`\n  ${operations.length} row(s) need updating`);
  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }
  if (operations.length > 0) {
    const result = await TournamentEdition.bulkWrite(operations, { ordered: false });
    console.log(`  modified ${result.modifiedCount}`);
  }
  console.log("Migration 45 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 45 (${apply ? "APPLY" : "DRY RUN"})`);

  const filter = { sportSlug: SPORT, kind: { $exists: true } };
  const count = await TournamentEdition.countDocuments(filter);
  console.log(`  ${count} classified edition(s) would be cleared`);
  if (!apply) {
    console.log("Dry run complete — re-run with --down --apply.");
    return;
  }
  const result = await TournamentEdition.updateMany(filter, {
    $unset: { ladder: "", grade: "", circuit: "", kind: "" },
  });
  console.log(`  cleared ${result.modifiedCount}`);
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      console.error("Migration 45 failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
