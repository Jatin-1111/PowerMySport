import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";
import { seriesFromEditionName, type EditionSeries } from "../shared/services/aita/editionSeries";

/**
 * Migration 48: re-run the tennis series classification after the circuit rules
 * were corrected.
 *
 * ── What moved ─────────────────────────────────────────────────────────────
 * One rule matched `(WTA|ATP)` and returned `circuit: "WTA"` for both, so every
 * ATP event on the calendar was stored as a WTA one. `EditionCircuit` had no
 * "ATP" member at all, so the type could not have expressed the right answer.
 * The rule is now one per tour, and UTR — a seeded tennis federation whose
 * events previously classified as `unknown` — has a rule of its own.
 *
 * ── Why a migration and not just the new code ──────────────────────────────
 * `circuit` and `kind` are stored, not derived per read (see the note in
 * TournamentEdition.ts), so a parser fix does not reach rows already written.
 * Migration 45 established this shape; this is the same operation with a newer
 * parser, and it supersedes 45's output wherever the two disagree.
 *
 * ── It corrects nothing today, and is kept anyway ──────────────────────────
 * Measured on 2026-09-22: of 279 tennis editions, exactly one name matches
 * ATP/WTA/UTR — "WTA 250 (Chennai)", which the old rule happened to file
 * correctly — and the dry run moves 0 rows. The bug was latent, not active,
 * because the only sourced tennis calendar is AITA's and it lists no ATP or UTR
 * events. This stays because a calendar re-approved against the old code before
 * this deploy would write ATP rows as WTA, and then it is no longer a no-op.
 *
 * ── Safety ─────────────────────────────────────────────────────────────────
 * Idempotent: rows whose classification did not move are skipped, so a re-run
 * writes nothing. Touches four short fields on tennis rows only and creates no
 * index — single-digit kilobytes against a cluster that has hit its 512MB
 * ceiling once, but still a write, so dry-run first and read the counts.
 *
 * USAGE
 *   npx ts-node src/migrations/48_reclassify_tennis_edition_circuits.ts
 *   npx ts-node src/migrations/48_reclassify_tennis_edition_circuits.ts --apply
 *
 * Not `npm run migrate:... -- --apply`: PowerShell eats the first bare `--`,
 * npm takes the flag for itself, and this reports a dry run having changed
 * nothing.
 *
 * There is no `down`. The previous state is what the old parser produced, and
 * restoring it would mean deliberately re-filing ATP events as WTA. Re-running
 * migration 45 would do that, and should not be done.
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
  console.log(`Migration 48: reclassify tennis edition circuits (${apply ? "APPLY" : "DRY RUN"})`);

  const rows = await TournamentEdition.find({ sportSlug: SPORT })
    .select("name officialName ladder grade circuit kind")
    .lean();
  console.log(`  ${rows.length} tennis editions\n`);

  const operations = [];
  /** Printed in full: a row changing circuit is exactly what this migration claims to fix. */
  const moves: string[] = [];

  for (const row of rows) {
    const series = seriesFromEditionName(row.name, row.officialName);
    if (sameSeries(row, series)) continue;

    moves.push(
      `    ${row.name}\n      ${row.circuit ?? "—"}/${row.kind ?? "—"}` +
        ` -> ${series.circuit ?? "—"}/${series.kind}`
    );
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

  if (moves.length > 0) {
    console.log(`  reclassified (${moves.length}):`);
    for (const line of moves.slice(0, 40)) console.log(line);
    if (moves.length > 40) console.log(`    …and ${moves.length - 40} more`);
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
  console.log("Migration 48 complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => up(options))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      console.error("Migration 48 failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
