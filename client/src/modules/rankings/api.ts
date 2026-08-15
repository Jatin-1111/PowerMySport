import { PAGE_SIZE } from "./config";

/**
 * Server-side readers for the ranking API.
 *
 * Note what is *not* here: a date of birth. The API never returns one — it is
 * `select: false` on the model precisely because these lists are largely
 * children — and `birthYear` is the public-safe field the UI shows instead.
 * If a future endpoint starts returning `dob`, that is a bug to report, not a
 * field to render.
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface RankingPoint {
  label: string;
  value: number;
}

export interface RankingEntry {
  _id: string;
  rank: number;
  regNo: string;
  givenName: string;
  familyName: string;
  fullName: string;
  birthYear?: number;
  state?: string;
  stateCode?: string;
  points: RankingPoint[];
  totalPoints: number;
  category: string;
  subcategory: string;
  asOnDate: string;

  // ── Derived, computed when the list was ingested ──────────────────────────
  /** Rank in the previous published list. Absent = new to this list. */
  prevRank?: number;
  /** Positive means the player moved up. Null when there is nothing to compare. */
  rankDelta: number | null;
  /** Rank within their own state, and how many of that state are ranked at all. */
  stateRank?: number;
  stateSize?: number | null;
  /** The next rung up and what it costs. Null when already inside the top tier. */
  nextTier?: RankingTier | null;
}

/** Points needed to sit inside the top `rank` of this list. */
export interface RankingBenchmark {
  rank: number;
  points: number;
}

export interface RankingTier extends RankingBenchmark {
  /** Points still needed to reach it. Always positive. */
  gap: number;
}

export interface RankingStateCount {
  state: string;
  count: number;
  inTop100: number;
}

export interface RankingBandProfile {
  label: string;
  from: number;
  to: number | null;
  playerCount: number;
  averageTotal: number;
  composition: Array<{
    label: string;
    average: number;
    isDeduction: boolean;
    /**
     * Printed on the sheet but not scored — the raw doubles column, whose 25%
     * sibling is the one in the total. Optional because snapshots written before
     * the ingest computed it do not carry it, and these payloads are cached for
     * half an hour after any deploy.
     */
    isInformational?: boolean;
  }>;
}

export interface RankingSnapshotMeta {
  asOnDate: string;
  columns?: string[];
  rowCount?: number;
  sourceUrl?: string;
  publishedAt?: string;
  /** The week the movement figures on each row are measured against. */
  comparedTo?: string;
  benchmarks?: RankingBenchmark[];
  stateCounts?: RankingStateCount[];
  bandProfiles?: RankingBandProfile[];
}

export interface RankingListResult {
  entries: RankingEntry[];
  snapshot: RankingSnapshotMeta | null;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RankingMeta {
  combos: Array<{
    category: string;
    subcategory: string;
    asOnDate: string | null;
    rowCount: number;
    columns: string[];
    available: boolean;
  }>;
  states: string[];
  source: { federation: string; acronym: string; url: string };
}

export interface PlayerHistoryPoint {
  category: string;
  subcategory: string;
  asOnDate: string;
  rank: number;
  totalPoints: number;
}

/** The context one standing needs to mean something. Computed by the API. */
export interface PlayerInsight {
  /** How many players are on this list. Null when the snapshot is missing. */
  listSize: number | null;
  /** How many from the player's state are ranked on it. */
  stateSize: number | null;
  /** "Top 25%" — already rounded up, so it never flatters. */
  percentile: number | null;
  nextTier: RankingTier | null;
  careerHigh: { rank: number; asOnDate: string } | null;
  /** Weeks we hold this player on this list. Not a career total. */
  weeksTracked: number;
  /** Null on lists shorter than 100 players, where the band means nothing. */
  weeksInTop100: number | null;
  /**
   * Optional on purpose. These responses are cached for half an hour, so the
   * first thirty minutes after any deploy serve payloads written by the previous
   * version — a field the UI treats as guaranteed is a 500 on a live page.
   */
  bands?: RankingBandProfile[];
}

export interface PlayerCurrentEntry extends RankingEntry {
  insight: PlayerInsight;
}

export interface PlayerResult {
  player: {
    regNo: string;
    fullName?: string;
    givenName?: string;
    familyName?: string;
    birthYear?: number | null;
    state?: string | null;
  };
  current: PlayerCurrentEntry[];
  history: PlayerHistoryPoint[];
}

/**
 * Never throws. A ranking page that renders an "unavailable" state beats one
 * that 500s the whole route when the API is briefly down.
 */
async function get<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as T) : null;
  } catch {
    return null;
  }
}

// `sport` is threaded through every call and defaults to tennis. The API has
// carried `sportSlug` on its documents since the mirror was built; sending it
// explicitly is what lets a second federation land without touching callers.
export function fetchRankingMeta(sport = "tennis"): Promise<RankingMeta | null> {
  return get<RankingMeta>(`/rankings/meta?sport=${encodeURIComponent(sport)}`, 3600);
}

export function fetchRankings(params: {
  sport?: string;
  category: string;
  subcategory: string;
  state?: string;
  search?: string;
  date?: string;
  page?: number;
}): Promise<RankingListResult | null> {
  const query = new URLSearchParams({
    sport: params.sport ?? "tennis",
    category: params.category,
    subcategory: params.subcategory,
    limit: String(PAGE_SIZE),
    page: String(params.page ?? 1),
  });
  if (params.state) query.set("state", params.state);
  if (params.search) query.set("search", params.search);
  if (params.date) query.set("date", params.date);
  // Filtered views churn far more than the base list, so they are cached for a
  // shorter window rather than pinned for an hour.
  const revalidate = params.state || params.search || params.date ? 300 : 1800;
  return get<RankingListResult>(`/rankings?${query.toString()}`, revalidate);
}

export interface RankingDate {
  asOnDate: string;
  rowCount: number;
  isLatest: boolean;
}

export function fetchRankingDates(
  category: string,
  subcategory: string,
  sport = "tennis",
): Promise<RankingDate[] | null> {
  const query = new URLSearchParams({ sport, category, subcategory });
  return get<RankingDate[]>(`/rankings/dates?${query.toString()}`, 1800);
}

export function fetchPlayer(
  regNo: string,
  sport = "tennis",
): Promise<PlayerResult | null> {
  const query = new URLSearchParams({ sport });
  return get<PlayerResult>(
    `/rankings/players/${encodeURIComponent(regNo)}?${query.toString()}`,
    1800,
  );
}

/**
 * Re-exported, not defined here. The implementation moved to `insights.ts` so
 * that client components can format a date without dragging these fetchers and
 * the ranking config into the browser bundle.
 */
export { formatAsOn } from "./insights";
