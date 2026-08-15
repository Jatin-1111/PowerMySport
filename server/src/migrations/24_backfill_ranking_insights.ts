import "dotenv/config";
import mongoose from "mongoose";
import { RankingEntry } from "../shared/models/RankingEntry";
import { RankingSnapshot } from "../shared/models/RankingSnapshot";
import { recomputeSnapshotInsights } from "../shared/services/aita/recomputeSnapshotInsights";

/**
 * Migration 24: Backfill the derived ranking analytics.
 *
 * The ingest pipeline now computes movement (`prevRank`), state rank, benchmark
 * tiers, the state distribution and the points-by-source bands whenever a list
 * publishes. Everything already in the database was ingested before that existed
 * and carries none of it, so the public pages would show a movement column that
 * is blank for every row until a new list arrives — and blank for the twelve
 * months of history behind the "view an earlier week" control forever.
 *
 * ── Order is load-bearing ────────────────────────────────────────────────────
 * `prevRank` is measured against the immediately preceding published list, so
 * snapshots must be processed per combo, oldest first. Sorting by
 * (category, subcategory, asOnDate) does that; do not reorder it for speed.
 *
 * Idempotent and re-runnable: a row is only written when its numbers actually
 * change, so a second pass over an already-backfilled history writes nothing.
 * That is also the fix for the one out-of-order case the live pipeline has — if
 * an older week is ever backfilled after newer ones are published, re-running
 * this repairs the whole chain.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────────
 * Two new numbers per row on a collection of a few hundred thousand rows, on a
 * shared-tier Atlas cluster that also holds real user accounts. The dry run
 * reports the row count so the storage cost is a decision and not a surprise.
 *
 * USAGE
 *   npm run migrate:ranking-insights                        # dry run (default)
 *   npm run migrate:ranking-insights -- --apply             # write
 *   npm run migrate:ranking-insights -- --combo=Boys/U-14   # one list only
 *   npm run migrate:ranking-insights -- --latest-only       # current lists only
 *   npm run migrate:ranking-insights -- --down --apply      # strip it all back
 */

interface Options {
  apply?: boolean;
  /** "Boys/U-14" — restrict to one combo, for a cheap first pass. */
  combo?: string;
  /** Only the current list for each combo, skipping the archived weeks. */
  latestOnly?: boolean;
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Starting migration 24: backfill ranking insights (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const filter: Record<string, unknown> = { status: "published" };
  if (options.latestOnly) filter.isLatestForCombo = true;
  if (options.combo) {
    const [category, subcategory] = options.combo.split("/");
    if (!category || !subcategory) {
      throw new Error(`--combo must look like "Boys/U-14", got "${options.combo}"`);
    }
    filter.category = category;
    filter.subcategory = subcategory;
  }

  // Oldest first within each combo — see the note above.
  const snapshots = await RankingSnapshot.find(filter)
    .sort({ category: 1, subcategory: 1, asOnDate: 1 })
    .select("_id category subcategory asOnDate")
    .lean();

  console.log(`Found ${snapshots.length} published snapshot(s) to process.`);
  if (snapshots.length === 0) return { snapshots: 0, rows: 0, changed: 0 };

  let rows = 0;
  let changed = 0;
  let processed = 0;
  let currentCombo = "";
  const perCombo = new Map<string, { snapshots: number; changed: number }>();

  for (const snapshot of snapshots) {
    const combo = `${snapshot.category}/${snapshot.subcategory}`;
    if (combo !== currentCombo) {
      currentCombo = combo;
      console.log(`\n  ${combo}`);
    }

    const result = await recomputeSnapshotInsights(snapshot._id, { apply });
    processed += 1;
    if (!result) {
      console.log(`    ${toIsoDate(snapshot.asOnDate)}  skipped (snapshot vanished)`);
      continue;
    }

    rows += result.rowCount;
    changed += result.entriesChanged;
    const tally = perCombo.get(combo) ?? { snapshots: 0, changed: 0 };
    tally.snapshots += 1;
    tally.changed += result.entriesChanged;
    perCombo.set(combo, tally);

    console.log(
      `    ${result.asOnDate}  ${String(result.rowCount).padStart(5)} rows  ` +
        `${String(result.entriesChanged).padStart(5)} changed  ` +
        `vs ${result.comparedTo ?? "—".padEnd(10)}  ` +
        `${result.benchmarkCount} tiers, ${result.stateCount} states, ${result.bandCount} bands`,
    );
  }

  console.log();
  console.log("-".repeat(72));
  console.log(`Snapshots processed : ${processed}`);
  console.log(`Rows examined       : ${rows.toLocaleString("en-IN")}`);
  console.log(`Rows ${apply ? "written       " : "needing a write"}: ${changed.toLocaleString("en-IN")}`);
  for (const [combo, tally] of [...perCombo.entries()].sort()) {
    console.log(
      `  ${combo.padEnd(16)} ${String(tally.snapshots).padStart(4)} snapshots, ` +
        `${tally.changed.toLocaleString("en-IN")} rows`,
    );
  }
  console.log("-".repeat(72));

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 24 completed.");
  return { snapshots: processed, rows, changed };
};

/**
 * Reversible, unlike migrations 20 and 21: every field this migration writes is
 * derived from data that is still present, so stripping them loses nothing that
 * `up()` cannot recreate exactly.
 */
export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Rolling back migration 24 (${apply ? "APPLY" : "DRY RUN"})...`);

  const entryFilter = {
    $or: [{ prevRank: { $exists: true } }, { stateRank: { $exists: true } }],
  };
  const snapshotFilter = {
    $or: [
      { benchmarks: { $exists: true } },
      { stateCounts: { $exists: true } },
      { bandProfiles: { $exists: true } },
      { comparedTo: { $exists: true } },
    ],
  };

  const entries = await RankingEntry.countDocuments(entryFilter);
  const snapshots = await RankingSnapshot.countDocuments(snapshotFilter);
  console.log(`${entries.toLocaleString("en-IN")} entr(ies) and ${snapshots} snapshot(s) carry derived fields.`);

  if (apply) {
    const entryResult = await RankingEntry.collection.updateMany(entryFilter, {
      $unset: { prevRank: "", stateRank: "" },
    });
    const snapshotResult = await RankingSnapshot.collection.updateMany(snapshotFilter, {
      $unset: { benchmarks: "", stateCounts: "", bandProfiles: "", comparedTo: "" },
    });
    console.log(
      `Cleared ${entryResult.modifiedCount.toLocaleString("en-IN")} entr(ies) and ` +
        `${snapshotResult.modifiedCount} snapshot(s).`,
    );
    console.log(
      "Note: the ingest pipeline recomputes these on every publish, so new lists " +
        "will carry them again. A full rollback also means reverting the service.",
    );
  } else {
    console.log("Dry run — nothing was written.");
  }

  console.log("Rollback completed.");
};

function toIsoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  const argOf = (name: string): string | undefined =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

  const options: Options = {
    apply: process.argv.includes("--apply"),
    latestOnly: process.argv.includes("--latest-only"),
    ...(argOf("combo") ? { combo: argOf("combo") as string } : {}),
  };
  const rollback = process.argv.includes("--down");

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      if (rollback) await down(options);
      else await up(options);
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
