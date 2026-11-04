import apiClient from "@lib/api/axios";

// Mirrors the web's modules/rankings/services/api.ts. Public routes: no sign-in needed, and the
// server never returns a date of birth, only birthYear.

export interface Tier {
  rank: number;
  points: number;
  gap: number;
}

export interface RankingEntry {
  _id: string;
  rank: number;
  regNo: string;
  fullName: string;
  birthYear?: number;
  state?: string;
  stateCode?: string;
  totalPoints: number;
  category: string;
  subcategory: string;
  asOnDate: string;
  prevRank?: number;
  /** Positive means moved up. Null means there is no previous list to compare with. */
  rankDelta: number | null;
  stateRank?: number;
  stateSize?: number | null;
  nextTier?: Tier | null;
}

export interface RankingSnapshotMeta {
  asOnDate: string;
  rowCount?: number;
  sourceUrl?: string;
  comparedTo?: string;
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
    available: boolean;
  }>;
  states: string[];
  source: { federation: string; acronym: string; url: string };
}

export interface RankingDate {
  asOnDate: string;
  rowCount: number;
  isLatest: boolean;
}

export interface PlayerInsight {
  listSize: number | null;
  stateSize: number | null;
  /** Already rounded up, minimum 1: "Top 25%" is 25. */
  percentile: number | null;
  nextTier: Tier | null;
  /** The best rank on this list within the weeks held. Never call it a career high. */
  careerHigh: { rank: number; asOnDate: string } | null;
  weeksTracked: number;
  weeksInTop100: number | null;
}

export interface ProjectionMovement {
  points: number;
  /** Positive means the rank improved. */
  rank: number;
  from: string;
}

export interface RankingProjection {
  window: {
    from: string;
    to: string;
    listsHeld: number;
    weeksCovered: number;
    coversFullCycle: boolean;
  };
  movement: {
    fourWeeks: ProjectionMovement | null;
    twelveWeeks: ProjectionMovement | null;
    fiftyTwoWeeks: ProjectionMovement | null;
  };
  activity: {
    improvingWeeks: number;
    decliningWeeks: number;
    pointsGained: number;
    pointsLost: number;
    averageRise: number;
    lastRiseAt: string | null;
    weeksSinceLastRise: number | null;
  };
  /** A ceiling, never a forecast. Null unless the history reaches back a full 52 weeks. */
  atRisk: { nextFourWeeks: number; nextTwelveWeeks: number; isComplete: boolean } | null;
  toNextTier: (Tier & { estimatedWeeks: number | null; weeklyRate: number }) | null;
}

export interface PlayerCurrentEntry extends RankingEntry {
  insight: PlayerInsight;
  projection?: RankingProjection | null;
}

export interface PlayerHistoryPoint {
  category: string;
  subcategory: string;
  asOnDate: string;
  rank: number;
  totalPoints: number;
}

export interface PlayerResult {
  player: { regNo: string; fullName?: string; birthYear?: number | null; state?: string | null };
  current: PlayerCurrentEntry[];
  history: PlayerHistoryPoint[];
}

export interface RankingStanding {
  rank: number;
  regNo: string;
  fullName: string;
  birthYear?: number;
  state?: string;
  category: string;
  subcategory: string;
  totalPoints: number;
  asOnDate: string;
  rankDelta: number | null;
}

export interface LinkedRanking {
  id: string;
  dependentId: string;
  dependentName: string;
  sportSlug: string;
  regNo: string;
  verifiedAt: string;
  standings: RankingStanding[];
}

export const rankingsApi = {
  meta: async (): Promise<RankingMeta> => (await apiClient.get("/rankings/meta")).data.data,

  dates: async (category: string, subcategory: string): Promise<RankingDate[]> =>
    (await apiClient.get("/rankings/dates", { params: { category, subcategory } })).data.data,

  list: async (params: {
    category: string;
    subcategory: string;
    state?: string;
    search?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<RankingListResult> => (await apiClient.get("/rankings", { params })).data.data,

  player: async (regNo: string): Promise<PlayerResult> =>
    (await apiClient.get(`/rankings/players/${encodeURIComponent(regNo)}`)).data.data,

  /** This account's linked rankings, newest first, with live standings. */
  linked: async (): Promise<LinkedRanking[]> => (await apiClient.get("/ranking-claims")).data.data,

  unlink: async (linkId: string): Promise<void> => {
    await apiClient.delete(`/ranking-claims/${linkId}`);
  },
};
