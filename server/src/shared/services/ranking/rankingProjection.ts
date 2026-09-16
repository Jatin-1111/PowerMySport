import { nextTierFor, type Benchmark } from "../aita/rankingInsights";

/**
 * What a player's week-by-week totals say about where they are heading.
 *
 * ── The one dataset nobody else has ──────────────────────────────────────────
 * The federation publishes a list. It does not publish last week's list, so it
 * cannot answer "what changed" and neither can anyone reading it. We hold every
 * week we have mirrored, which makes the *series* — not the current row — the
 * thing worth computing on.
 *
 * ── Why this reads deltas rather than results ────────────────────────────────
 * We never see a match, a draw or a tournament result. We see one number per
 * week. So every fact below is derived from the change in that number between
 * consecutive published lists, and the vocabulary reflects it: "improving weeks"
 * rather than "tournaments played", because two events in one week are one
 * positive delta and there is no honest way to tell them apart.
 *
 * ── The scoring rule this is built against ───────────────────────────────────
 * AITA counts a player's best 8 singles results from a rolling 52 weeks, plus a
 * quarter of their best 8 doubles (see `client/src/modules/rankings/utils/
 * aitaRules.ts`, which is the researched statement of it). Three consequences
 * drive the maths here, and getting any of them wrong produces a confident lie:
 *
 *   1. **A bad result never costs points.** So a negative delta is never a loss
 *      on court; it is a counted result ageing out and not being replaced.
 *   2. **Only eight count.** So a gain is worth the delta it produced, net of
 *      whatever it displaced — which is exactly what the delta already measures,
 *      and is why nothing here tries to reconstruct per-tournament scores.
 *   3. **Everything currently counted was earned in the last 52 weeks.** That is
 *      what makes the forward-looking number possible at all: a gain observed in
 *      week t leaves the counted set in week t + 52.
 *
 * ── Why "at risk" is an upper bound, and says so ─────────────────────────────
 * When a result ages out, the ninth-best result moves up to take its place, so
 * the actual fall is the aged-out result minus its replacement. We cannot see
 * the replacement. `pointsAtRisk` is therefore the most that can fall away if
 * the player adds nothing new, not a prediction that it will. Every field that
 * carries it is named and documented as a ceiling, and the UI must say so too.
 */

/** AITA's rolling window. See POINTS_FORMULA in the client's `aitaRules.ts`. */
export const ROLLING_WINDOW_WEEKS = 52;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Longest horizon we will put a number on.
 *
 * Two years of "at this rate" is not a forecast, it is arithmetic wearing a
 * forecast's clothes: juniors age into a new list, stop playing, or have a
 * season that looks nothing like the last one. Past this, the answer is "not at
 * this rate", which is more useful than a number nobody should act on.
 */
const MAX_ESTIMATE_WEEKS = 104;

export interface ProjectionHistoryPoint {
  asOnDate: Date | string;
  rank: number;
  totalPoints: number;
  /**
   * Snapshot version, when the caller knows it. Only consulted to break a tie
   * between two rows for the same date, which happens when the federation
   * re-uploads a corrected list: both rows are kept on purpose (see the note on
   * `contentHash` in RankingSnapshot) and the higher version is the live one.
   */
  version?: number;
}

export interface MovementOverHorizon {
  /** Change in total points. Positive means gained. */
  points: number;
  /** Change in rank, sign-flipped so positive always means "improved". */
  rank: number;
  /** The list this was measured against. */
  from: Date;
}

export interface RankingProjection {
  /** The span of published lists this is computed from. */
  window: {
    from: Date;
    to: Date;
    /** Published lists we hold for this player in this list, not calendar weeks. */
    listsHeld: number;
    /** Calendar weeks between the first and last of them. */
    weeksCovered: number;
    /** True when the history reaches back a full rolling window. */
    coversFullCycle: boolean;
  };

  /** Null for a horizon the history does not reach back to. */
  movement: {
    fourWeeks: MovementOverHorizon | null;
    twelveWeeks: MovementOverHorizon | null;
    fiftyTwoWeeks: MovementOverHorizon | null;
  };

  activity: {
    /** Weeks the total rose: new results entering the counted set. */
    improvingWeeks: number;
    /** Weeks the total fell: results ageing out faster than they are replaced. */
    decliningWeeks: number;
    pointsGained: number;
    /** Reported positive. The points lost to ageing out over the window. */
    pointsLost: number;
    /** Mean rise across improving weeks only. Zero when there were none. */
    averageRise: number;
    /** When a new result last counted. Null if the total has never risen. */
    lastRiseAt: Date | null;
    /** Weeks since then. The blunt "have they played?" number. */
    weeksSinceLastRise: number | null;
  };

  /**
   * The most that can fall away as results age out, if nothing new is added.
   * A ceiling, never a prediction. Null when the history is too short to see
   * the far end of the rolling window at all.
   */
  atRisk: {
    nextFourWeeks: number;
    nextTwelveWeeks: number;
    /**
     * False when our history starts later than one rolling window ago: gains
     * earned before we began mirroring are invisible, so the real figure can
     * only be higher than this one.
     */
    isComplete: boolean;
  } | null;

  /**
   * The next rung and what reaching it would take at the observed rate.
   * Null when the player is already inside the top tier, or when no benchmarks
   * were supplied.
   */
  toNextTier: {
    rank: number;
    points: number;
    gap: number;
    /**
     * Weeks at the rate this player has actually gained over the window. Null
     * when they have gained nothing (no rate to extend) or when the answer is
     * past MAX_ESTIMATE_WEEKS.
     */
    estimatedWeeks: number | null;
    /** Points gained per week over the window. The rate the estimate extends. */
    weeklyRate: number;
  } | null;
}

interface NormalisedPoint {
  time: number;
  rank: number;
  points: number;
}

/**
 * One point per published date, oldest first.
 *
 * The duplicate case is real rather than defensive: a corrected re-upload lands
 * as a second snapshot for the same as-on date, and both sets of rows are kept.
 * Taking both would invent a delta between a list and its own correction.
 */
const normalise = (history: ProjectionHistoryPoint[]): NormalisedPoint[] => {
  const byTime = new Map<number, { point: NormalisedPoint; version: number }>();

  for (const entry of history) {
    const time = new Date(entry.asOnDate).getTime();
    if (Number.isNaN(time)) continue;
    if (typeof entry.totalPoints !== "number" || typeof entry.rank !== "number") continue;

    const version = entry.version ?? 1;
    const existing = byTime.get(time);
    if (existing && existing.version >= version) continue;

    byTime.set(time, {
      version,
      point: { time, rank: entry.rank, points: entry.totalPoints },
    });
  }

  return [...byTime.values()].map(({ point }) => point).sort((a, b) => a.time - b.time);
};

/** The newest point at or before `time`, for measuring a horizon against. */
const pointAtOrBefore = (points: NormalisedPoint[], time: number): NormalisedPoint | null => {
  let match: NormalisedPoint | null = null;
  for (const point of points) {
    if (point.time <= time) match = point;
    else break;
  }
  return match;
};

const movementOver = (
  points: NormalisedPoint[],
  latest: NormalisedPoint,
  weeks: number
): MovementOverHorizon | null => {
  const target = latest.time - weeks * MS_PER_WEEK;
  // Only report a horizon the history actually reaches. Measuring "52 weeks" off
  // a series that starts 9 weeks ago would report a real number for a period we
  // cannot see, which is the one failure mode a parent could not detect.
  if (points[0]!.time > target) return null;

  const baseline = pointAtOrBefore(points, target);
  if (!baseline || baseline.time === latest.time) return null;

  return {
    points: latest.points - baseline.points,
    // Rank improves downward; every other number here is "up is good", and a
    // single field that reversed that convention would be misread every time.
    rank: baseline.rank - latest.rank,
    from: new Date(baseline.time),
  };
};

export function projectRanking(input: {
  history: ProjectionHistoryPoint[];
  benchmarks?: Benchmark[] | undefined;
}): RankingProjection | null {
  const points = normalise(input.history);
  // One list is a standing, not a trajectory. Nothing below means anything
  // without a previous week to measure against.
  if (points.length < 2) return null;

  const first = points[0]!;
  const latest = points[points.length - 1]!;
  const weeksCovered = Math.round((latest.time - first.time) / MS_PER_WEEK);
  const windowStart = latest.time - ROLLING_WINDOW_WEEKS * MS_PER_WEEK;
  const coversFullCycle = first.time <= windowStart;

  let improvingWeeks = 0;
  let decliningWeeks = 0;
  let pointsGained = 0;
  let pointsLost = 0;
  let lastRiseAt: number | null = null;

  // Gains that entered the counted set inside the current rolling window, kept
  // with their dates so the ageing-out horizon can be sliced out of them below.
  const gainsInCycle: Array<{ time: number; amount: number }> = [];

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const delta = current.points - previous.points;
    if (delta === 0) continue;

    const insideCycle = current.time > windowStart;

    if (delta > 0) {
      if (insideCycle) {
        improvingWeeks += 1;
        pointsGained += delta;
        gainsInCycle.push({ time: current.time, amount: delta });
      }
      // Recorded whether or not it is inside the window: "when did a new result
      // last count" is a fact about the player, not about our window.
      lastRiseAt = current.time;
    } else if (insideCycle) {
      decliningWeeks += 1;
      pointsLost += -delta;
    }
  }

  /**
   * A gain observed at time t leaves the counted set at t + 52 weeks. So the
   * points that can fall away in the next N weeks are the gains recorded
   * between one window ago and one window ago plus N.
   */
  const atRiskWithin = (weeks: number): number => {
    const horizonEnd = windowStart + weeks * MS_PER_WEEK;
    return gainsInCycle
      .filter((gain) => gain.time <= horizonEnd)
      .reduce((total, gain) => total + gain.amount, 0);
  };

  // With less than a full cycle of history there is no far end of the window to
  // look at: every gain we hold is younger than the window, so the honest answer
  // is "we cannot see that yet" rather than a zero that reads as "nothing due".
  const atRisk = coversFullCycle
    ? {
        nextFourWeeks: atRiskWithin(4),
        nextTwelveWeeks: atRiskWithin(12),
        isComplete: true,
      }
    : null;

  const weeksInCycle = Math.max(1, Math.min(weeksCovered, ROLLING_WINDOW_WEEKS));
  const weeklyRate = pointsGained / weeksInCycle;

  /**
   * The same rung the standing panel names, from the same function.
   *
   * Reimplementing "the next tier up" here would have been four lines, and the
   * two panels sit on one page: the moment they disagreed about which rung is
   * next — and they would, because `nextTierFor` walks past a tier the player
   * already has the points for — the page would be telling a parent two things
   * at once. One source, one answer.
   */
  const nextTier = input.benchmarks?.length
    ? nextTierFor(latest.rank, latest.points, input.benchmarks)
    : null;

  const rawEstimate = nextTier && weeklyRate > 0 ? Math.ceil(nextTier.gap / weeklyRate) : null;

  return {
    window: {
      from: new Date(first.time),
      to: new Date(latest.time),
      listsHeld: points.length,
      weeksCovered,
      coversFullCycle,
    },
    movement: {
      fourWeeks: movementOver(points, latest, 4),
      twelveWeeks: movementOver(points, latest, 12),
      fiftyTwoWeeks: movementOver(points, latest, ROLLING_WINDOW_WEEKS),
    },
    activity: {
      improvingWeeks,
      decliningWeeks,
      pointsGained,
      pointsLost,
      averageRise: improvingWeeks > 0 ? Math.round(pointsGained / improvingWeeks) : 0,
      lastRiseAt: lastRiseAt === null ? null : new Date(lastRiseAt),
      weeksSinceLastRise:
        lastRiseAt === null ? null : Math.round((latest.time - lastRiseAt) / MS_PER_WEEK),
    },
    atRisk,
    toNextTier: nextTier
      ? {
          rank: nextTier.rank,
          points: nextTier.points,
          gap: nextTier.gap,
          estimatedWeeks:
            rawEstimate !== null && rawEstimate <= MAX_ESTIMATE_WEEKS ? rawEstimate : null,
          weeklyRate: Math.round(weeklyRate * 100) / 100,
        }
      : null,
  };
}
