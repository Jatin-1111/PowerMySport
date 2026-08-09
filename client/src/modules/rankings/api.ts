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
}

export interface RankingSnapshotMeta {
  asOnDate: string;
  columns?: string[];
  rowCount?: number;
  sourceUrl?: string;
  publishedAt?: string;
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

export interface PlayerResult {
  player: {
    regNo: string;
    fullName?: string;
    givenName?: string;
    familyName?: string;
    birthYear?: number | null;
    state?: string | null;
  };
  current: RankingEntry[];
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

/** "2026-07-27T00:00:00.000Z" -> "27 Jul 2026" */
export function formatAsOn(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
