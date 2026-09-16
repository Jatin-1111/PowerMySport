import "dotenv/config";
import mongoose from "mongoose";
import { RankingEntry } from "../shared/models/RankingEntry";
import { RankingSnapshot } from "../shared/models/RankingSnapshot";

/**
 * Reclaim quota from the ranking mirror.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * On 2026-09-17 the cluster hit 512 of 512 MB and blocked writes for every
 * collection — bookings, payments and signups included, not just rankings.
 * `rankingentries` was 465 MB of the 510 that were metered, growing about 10 MB
 * a week from the weekly AITA sweep. This script is the controlled way to give
 * that space back.
 *
 * ── The one fact that makes this work ────────────────────────────────────────
 * The M0 tier meters LOGICAL size — `dataSize + indexSize`, summed over every
 * database on the cluster — not the compressed `storageSize` on disk. At the
 * incident those read 418.7 + 91.3 = 510.0 MB while `storageSize` was 213 MB,
 * which is why every doc quoting "~212 MB used" looked safe.
 *
 * The useful corollary: because the meter is logical, **deleting documents
 * frees quota immediately**. There is no compaction step to wait for, which
 * matters because M0 does not offer `compact` at all.
 *
 * ── The three steps, in this order on purpose ────────────────────────────────
 *   1. **Redundant index.** `snapshot_1` is fully covered by the unique
 *      `snapshot_1_regNo_1`, because a compound index serves queries on its own
 *      prefix. Dropping it loses no query plan and frees ~7 MB. It runs first
 *      because it is the only step that needs no write budget of its own, so it
 *      buys headroom for the steps that follow if the cluster is already
 *      refusing writes.
 *   2. **Dead snapshots' rows.** When the federation re-uploads a corrected
 *      list, the pipeline keeps both versions on purpose (see `contentHash` on
 *      RankingSnapshot) and the newer one wins. The older version's rows are
 *      then unreachable by every query in the codebase. Same for anything
 *      quarantined or failed. Nothing user-visible is lost.
 *   3. **Retention.** Entry rows older than `--keep-weeks` from the NEWEST list
 *      we hold. This is the only step that deletes data someone could otherwise
 *      have seen, which is why the default is deliberately conservative.
 *
 * ── Why the default is 54 weeks and not 52 ───────────────────────────────────
 * AITA scores the best 8 results over a rolling 52 weeks, and the projection on
 * the player page reads that window to say what is about to age out. It needs a
 * published list at or before the 52-week mark to know it has seen a full cycle;
 * without one it reports nothing rather than guessing (`coversFullCycle` in
 * `rankingProjection.ts`). Trimming to exactly 52 leaves that balanced on the
 * boundary, where one missing week silently switches the feature off. Two weeks
 * of margin costs about 3 MB and removes the whole class of problem.
 *
 * Going below 52 is a product decision, not a cleanup: it turns off the at-risk
 * figure on the player page and in the weekly digest, for everyone. The script
 * says so out loud rather than letting a flag quietly do it.
 *
 * ── What is deliberately NOT deleted ─────────────────────────────────────────
 * Snapshot documents. All 619 of them come to 3 MB, and they are the provenance
 * record: source URL, content hash, row count, parser diagnostics, why something
 * was quarantined. Keeping them means a pruned week is still *explained* — the
 * mirror can say "we ingested this list and later pruned its rows", which is a
 * different and more honest statement than a gap.
 *
 * USAGE — invoke ts-node directly, the way the other ops scripts here do.
 *
 *   npx ts-node src/scripts/pruneRankingHistory.ts                   # dry run
 *   npx ts-node src/scripts/pruneRankingHistory.ts --apply
 *   npx ts-node src/scripts/pruneRankingHistory.ts --only=index --apply
 *   npx ts-node src/scripts/pruneRankingHistory.ts --keep-weeks=40 --apply
 *
 * `npm run prune:rankings` works for the dry run, but do NOT reach for
 * `npm run prune:rankings -- --apply` on Windows: PowerShell strips the first
 * bare `--` as its own end-of-parameters marker, npm then reads `--apply` as a
 * flag meant for itself, and the script receives an empty argv. It reports a
 * dry run and changes nothing, which is safe but looks like the flag was
 * ignored. `npm run prune:rankings "--" --apply` also works if you prefer npm.
 */

type Step = "index" | "dead" | "retention";
const ALL_STEPS: Step[] = ["index", "dead", "retention"];

interface Options {
  apply: boolean;
  keepWeeks: number;
  only: Step[];
  force: boolean;
}

/** The index this drops, and the one that makes it redundant. */
const REDUNDANT_INDEX = { name: "snapshot_1", key: { snapshot: 1 } };
const COVERING_INDEX_KEY = { snapshot: 1, regNo: 1 };

/** The window the scoring rule uses, and the reason 52 is a floor worth naming. */
const SCORING_CYCLE_WEEKS = 52;
const DEFAULT_KEEP_WEEKS = 54;

/**
 * Refuse to delete more than this share of the collection without `--force`.
 *
 * The cutoff is measured from the newest list we hold rather than from today,
 * so a broken or stalled pipeline cannot drag the window forward and delete
 * everything. This is the second belt: if a bug ever did produce a cutoff that
 * swallows most of the mirror, the script stops and says so instead of running.
 */
const MAX_SHARE_WITHOUT_FORCE = 0.6;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const parseOptions = (argv: string[]): Options => {
  const only = argv
    .filter((arg) => arg.startsWith("--only="))
    .flatMap((arg) => arg.slice("--only=".length).split(","))
    .map((value) => value.trim())
    .filter(Boolean) as Step[];

  for (const step of only) {
    if (!ALL_STEPS.includes(step)) {
      throw new Error(`--only must be one or more of ${ALL_STEPS.join(", ")}`);
    }
  }

  const keepArg = argv.find((arg) => arg.startsWith("--keep-weeks="));
  const keepWeeks = keepArg ? Number(keepArg.slice("--keep-weeks=".length)) : DEFAULT_KEEP_WEEKS;
  if (!Number.isFinite(keepWeeks) || keepWeeks < 1) {
    throw new Error("--keep-weeks must be a positive number of weeks");
  }

  return {
    apply: argv.includes("--apply"),
    keepWeeks,
    only: only.length > 0 ? only : ALL_STEPS,
    force: argv.includes("--force"),
  };
};

/** `dataSize + indexSize` for this database: the number M0 actually meters. */
const meteredSize = async (): Promise<{ data: number; index: number; total: number }> => {
  const stats = await mongoose.connection.db!.command({ dbStats: 1, scale: 1 });
  const data = Number(stats.dataSize ?? 0);
  const index = Number(stats.indexSize ?? 0);
  return { data, index, total: data + index };
};

/** Step 1 — the redundant index. */
const dropRedundantIndex = async (apply: boolean): Promise<void> => {
  const collection = RankingEntry.collection;
  const indexes = await collection.indexes();

  const target = indexes.find((index) => index.name === REDUNDANT_INDEX.name);
  if (!target) {
    console.log("  [skip] snapshot_1 — not present (already dropped)");
    return;
  }

  // Never drop it on the word of a constant: confirm the covering index is
  // really there and really has `snapshot` as its first key. If someone has
  // reshaped the indexes since this was written, doing nothing is correct.
  const covering = indexes.find((index) => {
    const keys = Object.keys(index.key ?? {});
    return (
      keys[0] === "snapshot" &&
      keys[1] === "regNo" &&
      Object.keys(COVERING_INDEX_KEY).every(
        (key) => (index.key as Record<string, unknown>)[key] === 1
      )
    );
  });
  if (!covering) {
    console.log("  [BLOCKED] snapshot_1 — its covering index snapshot_1_regNo_1 is missing.");
    console.log("            Dropping it now would leave snapshot lookups unindexed.");
    return;
  }

  // `collStats` rather than the driver's removed `collection.stats()`. Only used
  // to print the size being reclaimed, so a cluster that refuses the command
  // still gets the drop, just without the number.
  const freed = await mongoose.connection
    .db!.command({ collStats: RankingEntry.collection.collectionName, scale: 1 })
    .then(
      (stats) => (stats.indexSizes as Record<string, number> | undefined)?.[REDUNDANT_INDEX.name]
    )
    .catch(() => undefined);

  if (!apply) {
    console.log(
      `  [would drop] snapshot_1${freed ? ` (~${mb(freed)})` : ""} — covered by ${covering.name}`
    );
    return;
  }

  console.log(`  [dropping] snapshot_1 — covered by ${covering.name}...`);
  await collection.dropIndex(REDUNDANT_INDEX.name);
};

/** Step 2 — rows belonging to snapshots nothing can reach. */
const pruneDeadSnapshots = async (apply: boolean): Promise<number> => {
  const snapshots = await RankingSnapshot.find({})
    .select("category subcategory asOnDate status version")
    .lean();

  // The live snapshot for a date is the highest-versioned PUBLISHED one. A
  // quarantined or failed run is never live, whatever its version number.
  const liveByDate = new Map<string, { id: string; version: number }>();
  for (const snapshot of snapshots) {
    if (snapshot.status !== "published") continue;
    const key = `${snapshot.category}|${snapshot.subcategory}|${new Date(snapshot.asOnDate).getTime()}`;
    const current = liveByDate.get(key);
    const version = snapshot.version ?? 1;
    if (!current || version > current.version) {
      liveByDate.set(key, { id: String(snapshot._id), version });
    }
  }

  const live = new Set([...liveByDate.values()].map((entry) => entry.id));
  const dead = snapshots.filter((snapshot) => !live.has(String(snapshot._id)));
  if (dead.length === 0) {
    console.log("  [skip] no superseded or quarantined snapshots");
    return 0;
  }

  let removed = 0;
  for (const snapshot of dead) {
    // `isLatest` should never be true on a dead snapshot's rows, but this is
    // the guard that makes that a fact rather than an assumption.
    const filter = { snapshot: snapshot._id, isLatest: { $ne: true } };
    const count = await RankingEntry.countDocuments(filter);
    if (count === 0) continue;

    const label = `${snapshot.category} ${snapshot.subcategory} ${new Date(snapshot.asOnDate)
      .toISOString()
      .slice(0, 10)} v${snapshot.version ?? 1} (${snapshot.status})`;

    if (!apply) {
      console.log(`  [would delete] ${count} rows — ${label}`);
    } else {
      const result = await RankingEntry.deleteMany(filter);
      console.log(`  [deleted] ${result.deletedCount} rows — ${label}`);
    }
    removed += count;
  }
  return removed;
};

/** Step 3 — everything older than the retention line. */
const applyRetention = async (options: Options): Promise<number> => {
  const newest = await RankingEntry.findOne({}).sort({ asOnDate: -1 }).select("asOnDate").lean();
  if (!newest) {
    console.log("  [skip] the mirror is empty");
    return 0;
  }

  // Measured from the newest list we hold, never from today: a stalled pipeline
  // must not be able to drag the window forward over live data.
  const newestTime = new Date(newest.asOnDate).getTime();
  const cutoff = new Date(newestTime - options.keepWeeks * MS_PER_WEEK);

  console.log(
    `  newest list ${new Date(newestTime).toISOString().slice(0, 10)}, ` +
      `keeping ${options.keepWeeks} weeks, cutoff ${cutoff.toISOString().slice(0, 10)}`
  );

  if (options.keepWeeks < SCORING_CYCLE_WEEKS) {
    console.log(
      `  [WARNING] ${options.keepWeeks} weeks is inside the ${SCORING_CYCLE_WEEKS}-week scoring cycle.\n` +
        "            The at-risk figure on the player page and in the weekly digest will\n" +
        "            stop appearing for everyone — it reports nothing rather than guessing\n" +
        "            when the history is too short. That is a product decision, not cleanup."
    );
  }

  const doomed = await RankingEntry.countDocuments({
    asOnDate: { $lt: cutoff },
    isLatest: { $ne: true },
  });
  if (doomed === 0) {
    console.log("  [skip] nothing older than the cutoff");
    return 0;
  }

  const total = await RankingEntry.estimatedDocumentCount();
  const share = doomed / Math.max(total, 1);
  if (share > MAX_SHARE_WITHOUT_FORCE && !options.force) {
    throw new Error(
      `Refusing to delete ${(share * 100).toFixed(0)}% of the mirror (${doomed} of ${total} rows). ` +
        `Re-run with --force if that is genuinely intended.`
    );
  }

  // Deleted per snapshot rather than as one big range delete. Each chunk is
  // about a thousand rows, it uses the snapshot index rather than scanning by
  // date, and a run interrupted halfway leaves whole weeks removed rather than
  // a half-deleted list.
  const stale = await RankingSnapshot.find({ asOnDate: { $lt: cutoff } })
    .select("category subcategory asOnDate")
    .sort({ asOnDate: 1 })
    .lean();
  const staleIds = stale.map((snapshot) => snapshot._id);

  let removed = 0;
  for (const snapshot of stale) {
    const filter = { snapshot: snapshot._id, isLatest: { $ne: true } };
    const count = await RankingEntry.countDocuments(filter);
    if (count === 0) continue;

    if (options.apply) {
      const result = await RankingEntry.deleteMany(filter);
      removed += result.deletedCount ?? 0;
    } else {
      removed += count;
    }
  }

  // Rows whose snapshot document has already gone, if one was ever removed by
  // hand. Caught by date, so nothing is left orphaned out of reach of the loop.
  //
  // `$nin: staleIds` is what keeps the dry run honest. Without it this counts
  // every row the loop above has just counted — in APPLY mode those are already
  // deleted so the total came out right, but the dry run reported exactly double
  // and would have had someone approve a number that was never real.
  const orphanFilter = {
    asOnDate: { $lt: cutoff },
    isLatest: { $ne: true },
    snapshot: { $nin: staleIds },
  };
  const orphans = await RankingEntry.countDocuments(orphanFilter);
  if (orphans > 0) {
    if (options.apply) {
      const result = await RankingEntry.deleteMany(orphanFilter);
      removed += result.deletedCount ?? 0;
      console.log(`  [deleted] ${result.deletedCount} rows with no surviving snapshot`);
    } else {
      removed += orphans;
      console.log(`  [would delete] ${orphans} rows with no surviving snapshot`);
    }
  }

  console.log(
    options.apply
      ? `  [deleted] ${removed} rows older than the cutoff`
      : `  [would delete] ${removed} rows older than the cutoff`
  );
  return removed;
};

export const prune = async (options: Options): Promise<void> => {
  const before = await meteredSize();
  console.log(
    `Metered size before: ${mb(before.total)} (data ${mb(before.data)} + indexes ${mb(before.index)})`
  );
  console.log(options.apply ? "Mode: APPLY\n" : "Mode: DRY RUN (re-run with --apply)\n");

  if (options.only.includes("index")) {
    console.log("Step 1 — redundant index");
    await dropRedundantIndex(options.apply);
  }

  if (options.only.includes("dead")) {
    console.log("\nStep 2 — superseded and quarantined snapshots");
    await pruneDeadSnapshots(options.apply);
  }

  if (options.only.includes("retention")) {
    console.log("\nStep 3 — retention");
    await applyRetention(options);
  }

  const after = await meteredSize();
  console.log(
    `\nMetered size after: ${mb(after.total)} (data ${mb(after.data)} + indexes ${mb(after.index)})`
  );
  if (options.apply) {
    console.log(`Freed: ${mb(Math.max(0, before.total - after.total))} of the 512 MB cap.`);
  } else {
    console.log("Nothing was changed. Re-run with --apply to act on the plan above.");
  }
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => prune(options))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      console.error("Prune failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
