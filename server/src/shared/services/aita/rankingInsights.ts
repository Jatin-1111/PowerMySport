/**
 * Derived analytics for one ranking list.
 *
 * ── Why these are computed at publish time, not per request ──────────────────
 * A rank number on its own means nothing to the person reading it. "412" is the
 * same fact AITA's PDF already gives them; "top 25% of 1,648, up 12 places, 45
 * points off the top 100" is the fact they came for. All of that is derivable
 * from the rows we already store — but derivable *per request* it is a set of
 * sorts and group-bys over 485k documents on a shared-tier cluster, several
 * times per page view.
 *
 * So it is computed once, when a list publishes, and stored: two small numbers
 * on each row (`prevRank`, `stateRank`) and three small aggregates on the
 * snapshot. Reads stay single-index lookups.
 *
 * Everything here is a pure function over the rows of one list, which is also
 * why it is a separate module: the interesting cases (ties, penalty columns,
 * lists shorter than a benchmark tier) are unit-testable without a database.
 */

export interface InsightRow {
  regNo: string;
  rank: number;
  totalPoints: number;
  /** Canonical state name. Absent when the printed code was not mappable. */
  state?: string | undefined;
  /** Label -> value straight off the source. The LAST entry is the total. */
  points: Array<{ label: string; value: number }>;
  /**
   * True when this row's `points` came from the per-player breakdown endpoint
   * rather than being the total alone.
   *
   * Only a sample of each band carries one — see `sampleBandComposition.ts` for
   * why, and `computeSampledBandProfiles` for what it does with them.
   */
  pointsSampled?: boolean | undefined;
}

/** Points needed to sit inside the top `rank`. */
export interface Benchmark {
  rank: number;
  points: number;
}

export interface StateCount {
  state: string;
  count: number;
  /** How many of that state's players sit in the national top 100. */
  inTop100: number;
}

export interface CompositionSlice {
  label: string;
  average: number;
  /**
   * True for columns that take points away rather than add them — the
   * "CUT FOR NO SHOW LATE WL" penalty. Stacking a deduction on top of the
   * things it deducts from would overstate the bar and misread the data, so the
   * flag travels with the number and the UI shows it separately.
   */
  isDeduction: boolean;
  /**
   * True for a column the sheet prints but does not score. The junior lists show
   * both `BEST Eight DBLS. PTS.` and `25% BEST Eight DBLS. PTS.`; only the
   * quarter is in the total, so stacking both double-counts doubles.
   *
   * Optional because snapshots written before this existed do not carry it, and
   * responses are cached for half an hour after any deploy.
   */
  isInformational?: boolean;
}

export interface BandProfile {
  label: string;
  from: number;
  /** null on the open-ended tail band. */
  to: number | null;
  playerCount: number;
  averageTotal: number;
  composition: CompositionSlice[];
  /**
   * How many players in this band the composition was measured from.
   *
   * Absent on snapshots computed before sampling existed, where the breakdown
   * was printed for every row and the composition covered the whole band. When
   * present it is smaller than `playerCount`, and the UI must say so — a chart
   * drawn from 15 of 1,500 players is honest only if it admits it.
   */
  sampleSize?: number;
  /**
   * Mean total of the sampled players specifically.
   *
   * The composition slices sum to this, not to `averageTotal`. Keeping both is
   * the point: `averageTotal` is exact because every row carries a total, while
   * the bars can only speak for the players they were measured from. A chart
   * that stacked sampled parts up to an unsampled whole would leave a gap it
   * could not explain, which reads as a bug.
   */
  compositionTotal?: number;
}

/**
 * The rungs of the ladder. Chosen to be the numbers people actually talk about
 * ("top 100", "top 50") rather than an even spread, because the whole point of
 * publishing them is to name the target a parent is aiming at.
 */
export const BENCHMARK_TIERS = [1, 10, 25, 50, 100, 250, 500, 1000] as const;

/** The band `StateCount.inTop100` counts. Fixed: it is in the field name. */
export const TOP_BAND = 100;

/** Disjoint on purpose — overlapping bands make the comparison unreadable. */
export const POINT_BANDS: ReadonlyArray<{ label: string; from: number; to: number | null }> = [
  { label: "Top 10", from: 1, to: 10 },
  { label: "11–100", from: 11, to: 100 },
  { label: "101 and below", from: 101, to: null },
];

const DEDUCTION_PATTERN = /\bcut\b|no\s*show|penalt/i;

/**
 * Label for the derived slice that accounts for points carried down from the
 * age group above. Read by the client, which expands `U-18` to `Under-18` for
 * display; keep the two in step if this ever changes.
 */
export const ROLLED_DOWN_PREFIX = "Playing up in ";

/**
 * Fewest sampled players a band may be drawn from.
 *
 * Three is not a statistical claim — it is a floor below which the average stops
 * describing a band at all. One player is not an average, and two cannot show a
 * spread. Bands thinner than this get no composition, which withholds the panel;
 * the alternative is a bar chart of one person labelled as ninety.
 */
export const MIN_SAMPLE_PER_BAND = 3;

/**
 * The bracket whose whole total rolls into this one.
 *
 * AITA's junior brackets step in twos, and a player only ever carries points
 * *down* — so `U-16` draws from `U-18` and nothing draws into `U-18`.
 */
export function nextBracketUp(subcategory: string | undefined): string | null {
  const match = /^U-(\d+)$/i.exec((subcategory ?? "").trim());
  if (!match) return null;
  const age = Number(match[1]);
  return age < 18 ? `U-${age + 2}` : null;
}

/**
 * Points required to be inside each tier.
 *
 * Defined as the *lowest* total held by anyone ranked at or above the tier,
 * rather than "the points of the player at rank N". Ranks tie constantly in
 * this data — seven players share rank 1642 in one real list — so "the player
 * at rank N" is not always one player, while a minimum over the band is
 * well-defined either way. It is also the number a parent needs: overtake that
 * and you are inside.
 */
export function computeBenchmarks(
  rows: InsightRow[],
  tiers: readonly number[] = BENCHMARK_TIERS,
): Benchmark[] {
  if (rows.length === 0) return [];

  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const deepest = ordered[ordered.length - 1]?.rank ?? 0;
  const out: Benchmark[] = [];

  for (const tier of tiers) {
    // Tiers arrive ascending, so the first one past the end of the list ends it.
    // A 397-player list has no "top 500", and inventing one would tell a parent
    // there is a rung above the last player.
    if (tier > deepest) break;

    let floor = Number.POSITIVE_INFINITY;
    for (const row of ordered) {
      if (row.rank > tier) break;
      if (row.totalPoints < floor) floor = row.totalPoints;
    }
    if (Number.isFinite(floor)) out.push({ rank: tier, points: round1(floor) });
  }
  return out;
}

/**
 * Players per state, and how many of each state's players reach the national
 * top 100 — the two numbers behind "where do India's ranked juniors come from".
 *
 * Rows whose state code did not map are skipped rather than bucketed as
 * "Unknown": they are isolated typos in AITA's own file (a single `PD` in a
 * 567-row list), and a phantom state in a distribution chart is worse than a
 * total that falls a row or two short.
 */
export function computeStateAggregates(rows: InsightRow[]): StateCount[] {
  const byState = new Map<string, { count: number; inTop100: number }>();

  for (const row of rows) {
    if (!row.state) continue;
    const bucket = byState.get(row.state) ?? { count: 0, inTop100: 0 };
    bucket.count += 1;
    if (row.rank <= TOP_BAND) bucket.inTop100 += 1;
    byState.set(row.state, bucket);
  }

  return [...byState.entries()]
    .map(([state, totals]) => ({ state, ...totals }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
}

/**
 * Each player's rank within their own state — the fact the source PDF cannot
 * answer, and the one a parent in Kerala cares about more than a national
 * number four digits long.
 *
 * Uses competition ranking: players tied nationally are tied within their state
 * too. Handing the seven players who share rank 1642 seven different state
 * ranks would be publishing an ordering we invented.
 */
export function assignStateRanks(rows: InsightRow[]): Map<string, number> {
  const byState = new Map<string, InsightRow[]>();
  for (const row of rows) {
    if (!row.state) continue;
    const bucket = byState.get(row.state);
    if (bucket) bucket.push(row);
    else byState.set(row.state, [row]);
  }

  const out = new Map<string, number>();
  for (const bucket of byState.values()) {
    // regNo breaks ties deterministically, so a re-run produces the same map.
    bucket.sort((a, b) => a.rank - b.rank || a.regNo.localeCompare(b.regNo));

    let stateRank = 0;
    let previousNational: number | null = null;
    bucket.forEach((row, index) => {
      if (row.rank !== previousNational) stateRank = index + 1;
      previousNational = row.rank;
      out.set(row.regNo, stateRank);
    });
  }
  return out;
}

/**
 * Average points by source, for the top 10 / the rest of the top 100 / everyone
 * below — "where the points at the top actually come from".
 *
 * This is the chart that tells a parent something no ranking table does: that
 * the players above their child are not simply winning more of the same
 * tournaments, they are drawing points from a category their child has not
 * entered yet.
 *
 * ── The columns do not add up, and this is where that is fixed ───────────────
 * Verified against the live lists on 2026-08-15: a junior's printed columns fall
 * well short of the printed total. The Boys Under-16 number one shows 1,291
 * points against columns summing to 250. Two causes, both handled here so that
 * no reader of this data has to rediscover them:
 *
 *   1. The raw doubles column is printed but not scored — only its 25% sibling
 *      counts. It is flagged `isInformational` and kept out of the arithmetic.
 *   2. The bracket above rolls down *in full* and has no column at all. A player
 *      in Under-16 who also enters Under-18 carries their entire Under-18 total
 *      into the Under-16 score, which for the top of the list is the single
 *      largest component.
 *
 * The roll-down is recovered per player as the residual — total, less the
 * columns that score, plus the deductions taken off them — rather than by
 * looking up the sibling list. That is deliberate: a lookup would make this
 * depend on whether the Under-18 sweep had already run this week, and a residual
 * cannot go stale or arrive in the wrong order.
 *
 * Averaging the per-player residuals is also more accurate than taking a
 * residual of the averages, which is what the browser had to do before this
 * moved here: the rounding happens once, at the end, instead of on every column
 * first.
 */
export function computeBandProfiles(
  rows: InsightRow[],
  subcategory?: string,
): BandProfile[] {
  const components = componentColumns(rows);
  if (components.length === 0) return [];

  const rolledDownLabel = nextBracketUp(subcategory);
  const rolledDown = rolledDownLabel ? rolledDownPerPlayer(rows, components) : null;

  const profiles: BandProfile[] = [];
  for (const band of POINT_BANDS) {
    const members = rows.filter(
      (row) => row.rank >= band.from && (band.to === null || row.rank <= band.to),
    );
    if (members.length === 0) continue;

    const composition: CompositionSlice[] = components.map(
      ({ index, label, isDeduction, isInformational }) => ({
        label,
        isDeduction,
        isInformational,
        average: round1(mean(members.map((m) => m.points[index]?.value ?? 0))),
      }),
    );

    if (rolledDown && rolledDownLabel) {
      composition.push({
        label: `${ROLLED_DOWN_PREFIX}${rolledDownLabel}`,
        isDeduction: false,
        average: round1(mean(members.map((m) => rolledDown.get(m.regNo) ?? 0))),
      });
    }

    profiles.push({
      label: band.label,
      from: band.from,
      to: band.to,
      playerCount: members.length,
      averageTotal: round1(mean(members.map((m) => m.totalPoints))),
      composition,
    });
  }

  // A column that is zero in every band is a column this category does not use.
  //
  // `dropUnusedColumns` works from the labels actually on the profiles, not from
  // `components`: the roll-down slice is derived rather than printed here, so an
  // allowlist drawn from the sheet's own columns would silently discard the very
  // thing that makes the bars add up.
  return dropUnusedColumns(profiles);
}

/**
 * Band profiles built from a sample of each band, for lists whose source prints
 * only a total.
 *
 * ── Why this exists alongside `computeBandProfiles` ──────────────────────────
 * The old ranking PDFs printed every point column for every player, so the
 * composition was free. The platform AITA moved to in August 2026 prints only
 * the total on the list and puts the breakdown behind one request *per player* —
 * roughly 11,000 requests to cover a weekly sweep, which is not a thing to do to
 * someone else's server. So a bounded sample of each band is fetched instead.
 *
 * `computeBandProfiles` is kept, not replaced: every snapshot archived before the
 * cutover has full per-row columns, and re-deriving those from a sample would
 * throw away data we already hold.
 *
 * ── What is exact and what is sampled ────────────────────────────────────────
 * `playerCount` and `averageTotal` come from **every** row in the band, because
 * every row carries a rank and a total. Only `composition` is sampled, and it is
 * reported with the `sampleSize` and `compositionTotal` it was measured against
 * so nothing has to be inferred downstream.
 *
 * ── The roll-down is not derived here ────────────────────────────────────────
 * `computeBandProfiles` recovers the points carried down from the bracket above
 * as a residual, because the old sheets never printed it. The new breakdown
 * *names* it — `14&Under` on a U-12 list, `Under Mens` and `Mens` on U-18 — so
 * this function uses the printed value and derives nothing. Measured across
 * ranks 1 to 1,078 on three list types: every sampled player's scoring columns
 * sum to their printed total exactly, so there is no residual left to recover.
 */
export function computeSampledBandProfiles(rows: InsightRow[]): BandProfile[] {
  const sampled = rows.filter((row) => row.pointsSampled && row.points.length >= 2);
  // No sample means no composition. Returning empty is what makes the client
  // withhold the panel, which is the right answer to "we have not measured this"
  // — better than a chart of one column.
  if (sampled.length === 0) return [];

  const components = componentColumns(sampled);
  if (components.length === 0) return [];

  const profiles: BandProfile[] = [];
  for (const band of POINT_BANDS) {
    const inBand = (row: InsightRow) =>
      row.rank >= band.from && (band.to === null || row.rank <= band.to);

    const members = rows.filter(inBand);
    if (members.length === 0) continue;

    const bandSample = sampled.filter(inBand);
    // ── A band needs enough players behind it to be worth drawing ─────────────
    // Rows whose own numbers do not reconcile are excluded from the sample, so a
    // band can end up thinner than it was asked for. One Women's Doubles band came
    // back represented by a *single* player whose total was eight times the band
    // average — a chart that is wrong in a way `sampleSize` alone does not warn a
    // reader about, because the number is right there and still reads as a chart.
    //
    // Below the floor the band gets no composition. `PointsComposition` withholds
    // the whole panel when any band cannot be accounted for, so one thin band
    // hides the panel for that list. That is the intended trade: this panel exists
    // to say where points come from, and it should say nothing rather than
    // something it cannot support.
    const composition: CompositionSlice[] =
      bandSample.length < MIN_SAMPLE_PER_BAND
        ? []
        : components.map(({ index, label, isDeduction, isInformational }) => ({
            label,
            isDeduction,
            isInformational,
            average: round1(mean(bandSample.map((m) => m.points[index]?.value ?? 0))),
          }));

    profiles.push({
      label: band.label,
      from: band.from,
      to: band.to,
      playerCount: members.length,
      averageTotal: round1(mean(members.map((m) => m.totalPoints))),
      composition,
      sampleSize: bandSample.length,
      compositionTotal: round1(mean(bandSample.map((m) => m.totalPoints))),
    });
  }

  return dropUnusedColumns(profiles);
}

/**
 * Removes columns that are zero in every band.
 *
 * A column this category never uses would otherwise render an empty legend entry
 * on every list. Shared by both band-profile functions so they cannot drift on
 * which columns they consider real.
 */
function dropUnusedColumns(profiles: BandProfile[]): BandProfile[] {
  const labels = [...new Set(profiles.flatMap((p) => p.composition.map((s) => s.label)))];
  const used = new Set(
    labels.filter((label) =>
      profiles.some((p) => (p.composition.find((s) => s.label === label)?.average ?? 0) !== 0),
    ),
  );
  return profiles.map((profile) => ({
    ...profile,
    composition: profile.composition.filter((slice) => used.has(slice.label)),
  }));
}

/**
 * The next rung up, and how many points away it is.
 *
 * Walks down from the tier just above the player: the *first* one that is
 * actually out of reach is the honest answer. Skipping tiers the player already
 * has the points for matters because rank and points do not move in perfect
 * lockstep — a player can hold top-100 points while sitting at 104 — and
 * telling them they need "0 more points" reads as a bug.
 */
export function nextTierFor(
  rank: number,
  totalPoints: number,
  benchmarks: Benchmark[],
): { rank: number; points: number; gap: number } | null {
  const above = benchmarks
    .filter((b) => b.rank < rank)
    .sort((a, b) => b.rank - a.rank);

  for (const tier of above) {
    const gap = round1(tier.points - totalPoints);
    if (gap > 0) return { rank: tier.rank, points: tier.points, gap };
  }
  return null;
}

interface ComponentColumn {
  index: number;
  label: string;
  isDeduction: boolean;
  /** Printed but not scored — see `CompositionSlice.isInformational`. */
  isInformational: boolean;
}

/** The points columns that make up the total, i.e. all but the total itself. */
function componentColumns(rows: InsightRow[]): ComponentColumn[] {
  // Addressed by index rather than by label: composed header labels are
  // best-effort in the parser and two of them colliding would silently make one
  // column stand in for another.
  const first = rows[0];
  if (!first || first.points.length < 2) return [];

  const printed = first.points.slice(0, -1);
  const isDoubles = (label: string) => /DBLS|DOUBLES/i.test(label);
  const isQuarter = (label: string) => /\b25\s*%/.test(label);
  // Only when the scoring sibling is actually present. A list that printed the
  // raw doubles column alone would be scoring it, and blanking it would leave
  // the bars short of the total instead of over it.
  const hasQuarterDoubles = printed.some(
    (point) => isDoubles(point.label) && isQuarter(point.label),
  );

  return printed.map((point, index) => ({
    index,
    label: point.label,
    isDeduction: DEDUCTION_PATTERN.test(point.label),
    isInformational:
      hasQuarterDoubles && isDoubles(point.label) && !isQuarter(point.label),
  }));
}

/**
 * Points each player carries down from the age group above, by registration
 * number.
 *
 * Returns null when the list does not behave the way the model says it should.
 * A residual is only meaningful if it comes out positive: a systematically
 * negative one means the columns already overshoot the total, so the rule has
 * changed and this whole slice would be fiction. Withholding it lets the client
 * fall back or draw nothing, which is the right answer to "these parts do not
 * add up" — better than publishing a confident wrong number.
 *
 * ── Why the threshold is a tenth and not a hundredth ─────────────────────────
 * AITA's own sheets do not always reconcile. On the Boys Under-16 list of
 * 2026-08-03, 18 rows in 1,602 print a total below the sum of their own columns
 * — Kaustubh Singh shows 465.75 against columns of 474.75, and he does not
 * appear on the Under-18 list at all, so no roll-down explains it. It is a
 * rounding or correction the federation applies somewhere we cannot see.
 *
 * A first cut set this guard at 1% and those 18 rows switched the whole feature
 * off. The guard exists to catch a *rule change*, which would contradict very
 * nearly every row, not to demand a clean sheet from a hand-maintained PDF. A
 * tenth still separates the two by an order of magnitude, and the individual bad
 * rows are handled where they matter: each is clamped to zero here, and the
 * browser refuses to draw that one player's own breakdown at all.
 */
function rolledDownPerPlayer(
  rows: InsightRow[],
  components: ComponentColumn[],
): Map<string, number> | null {
  const scoring = components.filter((c) => !c.isDeduction && !c.isInformational);
  const deductions = components.filter((c) => c.isDeduction);

  const out = new Map<string, number>();
  let contradictions = 0;

  for (const row of rows) {
    const counted = scoring.reduce((sum, c) => sum + (row.points[c.index]?.value ?? 0), 0);
    const deducted = deductions.reduce(
      (sum, c) => sum + Math.abs(row.points[c.index]?.value ?? 0),
      0,
    );
    const residual = row.totalPoints - counted + deducted;

    // Points are printed to three decimals; this is float noise, not disagreement.
    const tolerance = Math.max(0.01, Math.abs(row.totalPoints) * 0.001);
    if (residual < -tolerance) contradictions += 1;
    out.set(row.regNo, residual > 0 ? residual : 0);
  }

  // A tenth of the list disagreeing is a rule change; a scattering is the source
  // being the source. See the note above for the real numbers behind this.
  if (contradictions > Math.max(5, rows.length * 0.1)) return null;
  return out;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
