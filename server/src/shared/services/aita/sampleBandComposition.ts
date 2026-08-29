import { RankingEntry } from "../../models/RankingEntry";
import { AitaRankingSource, aitaRankingSource } from "./AitaRankingSource";
import { parsePointBreakdown } from "./rankingListParser";
import { POINT_BANDS } from "./rankingInsights";
import { AitaList } from "./types";
import { log as __rootLog } from "../../../utils/logger";
const logger = __rootLog.child("aitaBandSample");

/**
 * Fetches the point breakdown for a bounded sample of each ranking band.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * The old AITA PDFs printed every point column for every player, so the
 * points-composition chart cost nothing. The platform they moved to in August
 * 2026 prints only the total on the list page and puts the breakdown behind
 * `/ranking-player-point-view`, one request per player. A weekly sweep covers
 * about 11,000 players across twelve lists; fetching all of them would be
 * ~4.5 hours of requests at our own rate limit and an unreasonable thing to do
 * to a federation's server.
 *
 * A sample answers the question the chart actually asks. "What is the top 10
 * made of, compared with everyone below 100?" is a claim about a *band*, not
 * about individuals — it was always an average. Averaging fifteen players
 * instead of fifteen hundred widens the error bar; it does not change the kind
 * of statement being made. What matters is that the number of players behind it
 * travels with it, which is why `sampleSize` is stored and rendered.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────────
 * At most `MAX_SAMPLE_PER_BAND` per band × 3 bands × 12 lists = 540 requests a
 * sweep, ~13 minutes at the 1.5s rate limit. Deliberately run *after* the rows
 * are published, so the ranking list is live in 40 seconds and this is a slow
 * enrichment that can fail without taking anything down with it.
 */

/**
 * Per band, not per list.
 *
 * Fifteen is chosen against the shape of the bands rather than as a round
 * number: the "Top 10" band has ten members, so anything at or above ten makes
 * that band a census rather than a sample, and the two larger bands are where
 * the averaging happens. Raising it costs 36 requests a sweep per extra player.
 */
export const MAX_SAMPLE_PER_BAND = 15;

/** A row as the picker needs to see it. */
export interface SampleCandidate {
  regNo: string;
  rank: number;
  playerKey: string;
  /**
   * The total as the **list page** publishes it — net of any penalty.
   *
   * Carried through because it, not the breakdown endpoint's gross figure, is
   * what the components are reconciled against. See the note in
   * `sampleBandComposition`.
   */
  totalPoints: number;
}

/**
 * Chooses which players to fetch, spread evenly across each band.
 *
 * ── Systematic, not random ───────────────────────────────────────────────────
 * Two reasons. Composition varies *with rank inside a band* — the tail of
 * "101 and below" is players with a single result, the head of it is near
 * top-100 players — so an even spread across the band's range measures that
 * gradient, where a random draw would sometimes cluster and misreport it.
 *
 * And it is deterministic, which means the same list samples the same players
 * every week: a change in the chart is then a change in the data rather than a
 * change in who happened to be picked. It also makes this testable, and avoids
 * `Math.random()` in a pipeline whose whole design principle is that re-running
 * it produces the same answer.
 *
 * Pure: no network, no database. Exported so the arithmetic can be pinned
 * without either.
 */
export function pickCompositionSample(
  candidates: SampleCandidate[],
  perBand: number = MAX_SAMPLE_PER_BAND,
): SampleCandidate[] {
  if (perBand < 1) return [];

  const picked: SampleCandidate[] = [];
  for (const band of POINT_BANDS) {
    const members = candidates
      .filter((c) => c.rank >= band.from && (band.to === null || c.rank <= band.to))
      .sort((a, b) => a.rank - b.rank || a.regNo.localeCompare(b.regNo));

    if (members.length === 0) continue;
    if (members.length <= perBand) {
      // Small enough to take whole — this is the "Top 10" band every week.
      picked.push(...members);
      continue;
    }

    // Even spread including both ends: index 0 and index length-1 are always
    // taken, so the band's extremes are represented rather than trimmed off.
    const step = (members.length - 1) / (perBand - 1);
    const seen = new Set<number>();
    for (let i = 0; i < perBand; i++) {
      const index = Math.round(i * step);
      if (seen.has(index)) continue;
      seen.add(index);
      picked.push(members[index]!);
    }
  }
  return picked;
}

export interface SampleReport {
  requested: number;
  fetched: number;
  failed: number;
  /** Sampled players whose columns did not sum to their printed total. */
  unreconciled: number;
}

/**
 * Fetches and stores the breakdowns for one published snapshot's sample.
 *
 * Writes each sampled row's `points` in the shape the insights layer already
 * expects — the printed components in order, **with the total appended last**,
 * because `componentColumns` treats the final entry as the total and slices it
 * off. Getting that wrong would silently promote the total to a component and
 * double the height of every bar.
 */
export async function sampleBandComposition(
  snapshotId: unknown,
  list: AitaList,
  wid: number,
  options: { perBand?: number; source?: AitaRankingSource } = {},
): Promise<SampleReport> {
  const source = options.source ?? aitaRankingSource;
  const perBand = options.perBand ?? MAX_SAMPLE_PER_BAND;

  const stored = await RankingEntry.find({ snapshot: snapshotId })
    .select("regNo rank playerKey totalPoints")
    .lean();

  const candidates: SampleCandidate[] = stored
    .filter((row) => typeof row.playerKey === "string" && row.playerKey.length > 0)
    .map((row) => ({
      regNo: String(row.regNo),
      rank: Number(row.rank),
      playerKey: String(row.playerKey),
      totalPoints: Number(row.totalPoints ?? 0),
    }));

  const sample = pickCompositionSample(candidates, perBand);
  const report: SampleReport = {
    requested: sample.length,
    fetched: 0,
    failed: 0,
    unreconciled: 0,
  };
  if (sample.length === 0) return report;

  const operations: Array<Record<string, unknown>> = [];

  for (const candidate of sample) {
    let breakdown;
    try {
      const fragment = await source.fetchPointBreakdown(
        list,
        wid,
        candidate.playerKey,
        candidate.rank,
      );
      breakdown = parsePointBreakdown(fragment);
    } catch (error) {
      // One player's breakdown failing must not cost the other fourteen. The
      // count is reported so a systemic failure is visible as a number rather
      // than as a chart that quietly got thinner.
      report.failed += 1;
      logger.warn(
        `[aita-band-sample] ${list.code} rank ${candidate.rank} failed:`,
        error instanceof Error ? error.message : error,
      );
      continue;
    }

    if (breakdown.slices.length === 0 || breakdown.totalPoints === null) {
      report.failed += 1;
      continue;
    }

    // ── A row that contradicts itself is excluded, not averaged in ───────────
    // AITA's own sheets do not always reconcile: on the Boys U-16 list of
    // 2026-08-03, 18 rows in 1,602 print a total below the sum of their own
    // columns. Across a whole band that was 1% noise and the right call was to
    // keep the rows. In a sample of fifteen it is not noise — one row nine points
    // out moves the band's mean by 0.6, which is how the first live run of this
    // came back with a band whose bars overshot its own total.
    //
    // So the small sample changes the answer: a player whose numbers do not add
    // up cannot contribute to a chart whose whole promise is that its segments
    // are the total. Excluded and counted, so a source-wide change shows up as a
    // number rather than as bars that drift.
    // ── 🚨 The two endpoints do not report the same total ─────────────────────
    // The list page publishes the total **net** of the penalty; the breakdown
    // endpoint publishes it **gross**, with the penalty as its own row. Boys U-16
    // rank 638 on 2026-08-10: the list says 30, the breakdown says 40, and the
    // penalty is 10. Measured across a spread of 15 players, `scoring` equals the
    // breakdown's own total *exactly* — to 0.0000 on the mean — which is what
    // hides the discrepancy if only the breakdown is looked at.
    //
    // The list value is the authoritative one: it is the number the player is
    // ranked on and the number every other panel already shows. So the identity
    // this pipeline holds to is
    //
    //     scoring columns − penalty = list total
    //
    // which is the same shape the old PDFs had. The breakdown's gross total is
    // deliberately discarded rather than stored.
    const scoring = breakdown.slices
      .filter((s) => !s.isInformational && !s.isDeduction)
      .reduce((sum, s) => sum + s.value, 0);
    const penalty = breakdown.slices
      .filter((s) => s.isDeduction)
      .reduce((sum, s) => sum + Math.abs(s.value), 0);

    // Points are printed to two decimals; this is float noise, not disagreement.
    const tolerance = Math.max(0.05, Math.abs(candidate.totalPoints) * 0.001);
    if (Math.abs(scoring - penalty - candidate.totalPoints) > tolerance) {
      // AITA's own sheets do not always reconcile — 18 rows in 1,602 on one Boys
      // U-16 list print a total below the sum of their own columns. Across a
      // whole band that was 1% noise worth keeping. In a sample of fifteen it is
      // not noise: one row nine points out moves the band's mean by 0.6. A chart
      // whose whole promise is that its segments are the total cannot average in
      // a player whose numbers refuse to be.
      report.unreconciled += 1;
      continue;
    }

    report.fetched += 1;
    operations.push({
      updateOne: {
        filter: { snapshot: snapshotId, regNo: candidate.regNo },
        update: {
          $set: {
            // Source labels are kept verbatim, the way the table headers are:
            // the client's `plainPointLabel` is the one place that turns
            // federation shorthand into something a parent reads.
            // The last entry is the total by convention — `componentColumns`
            // slices it off. It is the **list** total, so the stored row keeps the
            // same shape the archived PDF-era rows have: components that sum to
            // the total plus the penalty, with the penalty flagged as a deduction
            // to be added back.
            points: [
              ...breakdown.slices.map((s) => ({ label: s.label, value: s.value })),
              { label: "Total Pts.", value: candidate.totalPoints },
            ],
            pointsSampled: true,
          },
        },
      },
    });
  }

  if (operations.length > 0) {
    await RankingEntry.bulkWrite(operations as never[], { ordered: false });
  }

  logger.info(
    `[aita-band-sample] ${list.code}: sampled ${report.fetched}/${report.requested}` +
      `${report.failed > 0 ? `, ${report.failed} failed` : ""}` +
      `${report.unreconciled > 0 ? `, ${report.unreconciled} did not reconcile` : ""}`,
  );
  return report;
}
