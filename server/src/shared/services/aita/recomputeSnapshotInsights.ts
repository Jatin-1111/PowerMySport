import { RankingEntry } from "../../models/RankingEntry";
import { RankingSnapshot } from "../../models/RankingSnapshot";
import {
  assignStateRanks,
  computeBandProfiles,
  computeBenchmarks,
  computeSampledBandProfiles,
  computeStateAggregates,
  type InsightRow,
} from "./rankingInsights";

/**
 * Writes the derived analytics for one published snapshot.
 *
 * Reads the rows back out of the database rather than taking them from the
 * parser, which costs one extra find of a few thousand small documents per
 * ingest and buys a single code path shared with the backfill migration. The
 * alternative — one implementation over `parsed.rows` for new lists and another
 * over stored rows for old ones — is two chances to compute a rank differently
 * and no way to notice.
 *
 * Idempotent: re-running writes nothing when the numbers are already right, so
 * it is safe to call on every publish and safe to re-run over the whole history.
 */

/** Rows are updated in chunks so a 1,600-row list is not one giant command. */
const ENTRY_CHUNK_SIZE = 500;

export interface RecomputeResult {
  snapshotId: string;
  category: string;
  subcategory: string;
  asOnDate: string;
  rowCount: number;
  /** Rows whose `prevRank`/`stateRank` actually changed. */
  entriesChanged: number;
  /** The date `prevRank` was measured against; null when this is the oldest. */
  comparedTo: string | null;
  benchmarkCount: number;
  stateCount: number;
  bandCount: number;
}

export async function recomputeSnapshotInsights(
  snapshotId: unknown,
  options: { apply?: boolean } = {}
): Promise<RecomputeResult | null> {
  const apply = options.apply ?? true;

  const snapshot = await RankingSnapshot.findById(snapshotId)
    .select("sportSlug category subcategory asOnDate")
    .lean();
  if (!snapshot) return null;

  const stored = await RankingEntry.find({ snapshot: snapshot._id })
    .select("regNo rank totalPoints state points pointsSampled prevRank stateRank")
    .lean();

  const base = {
    snapshotId: String(snapshot._id),
    category: String(snapshot.category),
    subcategory: String(snapshot.subcategory),
    asOnDate: toIsoDate(snapshot.asOnDate),
    rowCount: stored.length,
  };

  if (stored.length === 0) {
    return {
      ...base,
      entriesChanged: 0,
      comparedTo: null,
      benchmarkCount: 0,
      stateCount: 0,
      bandCount: 0,
    };
  }

  // ── Baseline for movement ──────────────────────────────────────────────────
  // The immediately preceding *published* list for this combo. Quarantined ones
  // are excluded here even though the row-count validator uses them as its
  // baseline: an unpublished list has no rows to compare against, and its
  // absence is exactly why the week after it needs to reach further back.
  const previous = await RankingSnapshot.findOne({
    sportSlug: snapshot.sportSlug,
    category: snapshot.category,
    subcategory: snapshot.subcategory,
    status: "published",
    asOnDate: { $lt: snapshot.asOnDate },
    _id: { $ne: snapshot._id },
  })
    .sort({ asOnDate: -1 })
    .select("asOnDate")
    .lean();

  const previousRanks = new Map<string, number>();
  if (previous) {
    const priorRows = await RankingEntry.find({ snapshot: previous._id })
      .select("regNo rank")
      .lean();
    for (const row of priorRows) previousRanks.set(String(row.regNo), Number(row.rank));
  }

  const rows: InsightRow[] = stored.map((row) => ({
    regNo: String(row.regNo),
    rank: Number(row.rank),
    totalPoints: Number(row.totalPoints ?? 0),
    state: row.state ? String(row.state) : undefined,
    points: Array.isArray(row.points) ? row.points : [],
    pointsSampled: row.pointsSampled === true,
  }));

  const stateRanks = assignStateRanks(rows);
  const benchmarks = computeBenchmarks(rows);
  const stateCounts = computeStateAggregates(rows);
  // ── Which band-profile path applies ───────────────────────────────────────
  // Two eras of data live in this collection and they are measured differently.
  //
  // Snapshots archived before the August 2026 cutover have every point column on
  // every row, because the source PDFs printed them; their composition covers
  // the whole band and the points carried down from the bracket above have to be
  // recovered as a residual. Snapshots ingested since have a total per row and a
  // real breakdown for a sampled subset, where the roll-down is printed outright.
  //
  // Deciding by "are any rows flagged sampled?" rather than by date, because the
  // flag is the actual property the arithmetic depends on — and because a
  // snapshot whose sampling stage failed should fall through to the old path and
  // produce nothing, rather than half a chart.
  const hasSample = rows.some((row) => row.pointsSampled);
  const bandProfiles = hasSample
    ? computeSampledBandProfiles(rows)
    : // Subcategory is load-bearing on this path, not decoration: it is what tells
      // the band profiles whether an age group sits above this one whose points
      // roll down and must be recovered.
      computeBandProfiles(rows, String(snapshot.subcategory));

  // ── Row updates ───────────────────────────────────────────────────────────
  // Only rows whose values actually move are written. That is what makes a
  // re-run over 52 weeks × 12 lists cheap, and it makes `entriesChanged` an
  // honest number rather than "every row, again".
  const operations: Array<Record<string, unknown>> = [];
  for (const row of stored) {
    const regNo = String(row.regNo);
    const desiredPrev = previousRanks.get(regNo) ?? null;
    const desiredState = stateRanks.get(regNo) ?? null;
    const currentPrev = typeof row.prevRank === "number" ? row.prevRank : null;
    const currentState = typeof row.stateRank === "number" ? row.stateRank : null;
    if (desiredPrev === currentPrev && desiredState === currentState) continue;

    const set: Record<string, number> = {};
    const unset: Record<string, ""> = {};
    // A previously-set value has to be actively removed, not just left alone:
    // re-running after a correction, or after an earlier week is backfilled,
    // can legitimately turn a movement figure back into "new to this list".
    if (desiredPrev === null) unset.prevRank = "";
    else set.prevRank = desiredPrev;
    if (desiredState === null) unset.stateRank = "";
    else set.stateRank = desiredState;

    operations.push({
      updateOne: {
        filter: { _id: row._id },
        update: {
          ...(Object.keys(set).length > 0 ? { $set: set } : {}),
          ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
        },
      },
    });
  }

  if (apply && operations.length > 0) {
    for (let i = 0; i < operations.length; i += ENTRY_CHUNK_SIZE) {
      await RankingEntry.bulkWrite(operations.slice(i, i + ENTRY_CHUNK_SIZE) as never[], {
        ordered: false,
      });
    }
  }

  if (apply) {
    await RankingSnapshot.updateOne(
      { _id: snapshot._id },
      {
        $set: {
          benchmarks,
          stateCounts,
          bandProfiles,
          ...(previous?.asOnDate ? { comparedTo: previous.asOnDate } : {}),
        },
        ...(previous?.asOnDate ? {} : { $unset: { comparedTo: "" } }),
      }
    );
  }

  return {
    ...base,
    entriesChanged: operations.length,
    comparedTo: previous?.asOnDate ? toIsoDate(previous.asOnDate) : null,
    benchmarkCount: benchmarks.length,
    stateCount: stateCounts.length,
    bandCount: bandProfiles.length,
  };
}

function toIsoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}
