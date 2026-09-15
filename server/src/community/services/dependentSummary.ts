import { Player } from "../../client/models/Player";

/**
 * What a parent's children look like to another parent on Discover.
 *
 * ── Why this exists ──
 *
 * A community profile used to read its sport, city and age off the parent's own
 * `User` record, which is exactly where none of that lives: a parent signs up to
 * find things for a child, so their own row has no sport, usually no city and no
 * date of birth. Every parent card rendered "N/A · N/A · no sports", and the
 * Discover page's sport and city filters — both built from those same fields —
 * filtered nothing.
 *
 * The information a parent actually wants when deciding whether to message a
 * stranger is about that stranger's CHILD: what they play, roughly how old they
 * are, and where. That lives on the dependent `Player` rows, and this module is
 * the one place that turns those rows into something publishable.
 *
 * ── What is deliberately not in here ──
 *
 * The child's name, exact age and date of birth. A summary line is "Tennis ·
 * Boys U-14 · Chandigarh" and nothing more: enough for a parent in Chandigarh to
 * recognise a peer, not enough to identify a specific minor. Everything this
 * module returns is either coarse (an age BAND, not an age) or already public
 * about the parent (their city).
 */

/**
 * A competition age ladder, as ascending "under" cut-offs.
 *
 * A child belongs to the SMALLEST cut-off they are still under, so a 13-year-old
 * is U-14 on the even ladder and U-15 on the odd one. Past the last cut-off
 * there is no junior band left and the child is simply a senior.
 */
type AgeLadder = readonly number[];

/** Tennis, basketball, hockey — the even ladder. */
const EVEN: AgeLadder = [12, 14, 16, 18];

/** Badminton, table tennis, squash, chess, football — the odd ladder. */
const ODD: AgeLadder = [11, 13, 15, 17, 19];

/**
 * Sport → ladder.
 *
 * ── Read this before trusting a label ──
 *
 * Indian federations do NOT share one ladder, which is the whole reason this map
 * exists rather than a single constant: AITA runs tennis at U-12/14/16/18 while
 * BAI runs badminton at U-13/15/17/19, so a single ladder is guaranteed to show
 * one of the two sports a category its own parents do not use.
 *
 * The entries below are a starting point and want a review pass per sport from
 * someone who follows that federation. Cricket and athletics are spelled out in
 * full rather than reusing EVEN because their top bands are U-19 and U-20, not
 * U-18 — that tail is the part a generic ladder always gets wrong.
 *
 * Keys are matched case- and separator-insensitively (see `normalizeSport`), so
 * "Table Tennis", "table-tennis" and "TABLE TENNIS" all land on the same row.
 */
const LADDERS: Record<string, AgeLadder> = {
  tennis: EVEN,
  basketball: EVEN,
  hockey: EVEN,
  volleyball: EVEN,
  swimming: EVEN,
  cricket: [14, 16, 19],
  athletics: [14, 16, 18, 20],
  badminton: ODD,
  tabletennis: ODD,
  squash: ODD,
  chess: ODD,
  football: ODD,
};

/** The ladder for a sport nobody has classified yet. */
const DEFAULT_LADDER = EVEN;

const normalizeSport = (sport: string) => sport.toLowerCase().replace(/[^a-z]/g, "");

/**
 * "U-14", or "Senior" once a child has aged out of every junior band.
 *
 * Null rather than a guess when the age is unknown — a band is the only number
 * about the child on the card, and an invented one is worse than a missing one.
 */
export const ageBandFor = (
  age: number | null | undefined,
  sport?: string | null
): string | null => {
  if (typeof age !== "number" || !Number.isFinite(age) || age <= 0 || age > 25) {
    return null;
  }

  const ladder = (sport && LADDERS[normalizeSport(sport)]) || DEFAULT_LADDER;
  const band = ladder.find((cutoff) => age < cutoff);
  return band ? `U-${band}` : "Senior";
};

/** One child, reduced to the few things another parent can act on. */
export interface DependentSummary {
  sport: string | null;
  ageBand: string | null;
  /**
   * "Boy" or "Girl" — the half of a junior competition category that the age
   * band does not carry, since every Indian federation draws its draws as Boys
   * U-14 / Girls U-14 rather than a single mixed one.
   *
   * Null for a child recorded as OTHER, and for one with no gender on file.
   * Those two cases are deliberately the same shape on the wire: a parent who
   * chose not to categorise their child should not be flagged as having done so
   * to every stranger who opens their profile.
   */
  gender: "Boy" | "Girl" | null;
  city: string | null;
}

/** The dependent fields this module reads. Nothing that names the child. */
const DEPENDENT_FIELDS = "userId age dob gender sportsFocus chosenSport wizardCity location";

type DependentRow = {
  userId: unknown;
  age?: number | null;
  dob?: Date | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  sportsFocus?: string[] | null;
  chosenSport?: string | null;
  wizardCity?: string | null;
  location?: string | null;
};

/**
 * `age` is denormalised onto the row and goes stale — it is whatever the parent
 * typed on the day they added the child, and nothing ages it. The date of birth
 * is the only field that stays true, so it wins wherever both exist.
 */
const resolveAge = (row: DependentRow): number | null => {
  if (row.dob) {
    const born = new Date(row.dob);
    if (!Number.isNaN(born.getTime())) {
      const now = new Date();
      let age = now.getUTCFullYear() - born.getUTCFullYear();
      const monthDelta = now.getUTCMonth() - born.getUTCMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
        age -= 1;
      }
      return age >= 0 ? age : null;
    }
  }
  return typeof row.age === "number" && Number.isFinite(row.age) ? row.age : null;
};

const clean = (value: unknown): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
};

/** Storage vocabulary → the word a parent reads on a draw sheet. */
const genderLabel = (gender: DependentRow["gender"]): "Boy" | "Girl" | null =>
  gender === "MALE" ? "Boy" : gender === "FEMALE" ? "Girl" : null;

const toSummary = (row: DependentRow, fallbackCity: string | null): DependentSummary => {
  // `chosenSport` is the sport the parent committed to on the assessment
  // results page; `sportsFocus` is everything they were considering. The
  // decision beats the shortlist.
  const sport = clean(row.chosenSport) || clean(row.sportsFocus?.[0]);

  return {
    sport,
    ageBand: ageBandFor(resolveAge(row), sport),
    gender: genderLabel(row.gender),
    // `location` holds the Indian STATE, not a city — it is the last resort
    // rather than a peer of the other two, or a Chandigarh parent reads
    // "Punjab" where they expected a city.
    city: clean(row.wizardCity) || fallbackCity || clean(row.location),
  };
};

/** Drops children we know nothing publishable about. */
const isRenderable = (summary: DependentSummary) =>
  Boolean(summary.sport || summary.ageBand || summary.city || summary.gender);

/**
 * Summaries for one parent's children, newest child last.
 *
 * `fallbackCity` is the parent's own city from their `User` row, used when a
 * child was added outside the assessment wizard and so carries no city of its
 * own — which is most of them.
 */
export const summarizeDependents = async (
  parentId: string,
  fallbackCity: string | null
): Promise<DependentSummary[]> => {
  const rows = await Player.find({ userId: parentId, type: "DEPENDENT" })
    .select(DEPENDENT_FIELDS)
    .sort({ createdAt: 1 })
    .lean<DependentRow[]>();

  return rows.map((row) => toSummary(row, fallbackCity)).filter(isRenderable);
};

/**
 * The same thing for a page of search results.
 *
 * One query for every parent on screen rather than one per parent: Discover
 * renders up to twenty cards, and this used to be the shape of query that turns
 * a search box into twenty round trips per keystroke.
 */
export const summarizeDependentsFor = async (
  parentIds: string[],
  fallbackCityById: Map<string, string | null>
): Promise<Map<string, DependentSummary[]>> => {
  const byParent = new Map<string, DependentSummary[]>();
  if (!parentIds.length) {
    return byParent;
  }

  const rows = await Player.find({ userId: { $in: parentIds }, type: "DEPENDENT" })
    .select(DEPENDENT_FIELDS)
    .sort({ createdAt: 1 })
    .lean<DependentRow[]>();

  for (const row of rows) {
    const parentId = String(row.userId);
    const summary = toSummary(row, fallbackCityById.get(parentId) ?? null);
    if (!isRenderable(summary)) {
      continue;
    }
    const existing = byParent.get(parentId);
    if (existing) {
      existing.push(summary);
    } else {
      byParent.set(parentId, [summary]);
    }
  }

  return byParent;
};

/** Distinct sports across a parent's children, for the Discover sport filter. */
export const sportsOf = (summaries: DependentSummary[]): string[] =>
  Array.from(
    new Set(summaries.map((summary) => summary.sport).filter((sport): sport is string => !!sport))
  );

/**
 * Every distinct city across a parent's children, for the Discover city filter.
 *
 * A list rather than one city for the same reason `sportsOf` is a list: siblings
 * do not have to train in the same place, and collapsing to the first one makes
 * a parent unfindable under the second child's city — they are a real peer to
 * families there and the filter would say otherwise.
 */
export const citiesOf = (summaries: DependentSummary[]): string[] =>
  Array.from(
    new Set(summaries.map((summary) => summary.city).filter((city): city is string => !!city))
  );

/**
 * The single city to show where only one fits (a card subtitle, the legacy
 * `city` field). The first child's, and deliberately NOT a summary of the rest —
 * callers that can show them all should use `citiesOf`.
 */
export const cityOf = (summaries: DependentSummary[]): string | null =>
  summaries.find((summary) => summary.city)?.city ?? null;
