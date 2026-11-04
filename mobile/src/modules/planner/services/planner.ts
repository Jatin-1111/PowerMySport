import apiClient from "@lib/api/axios";
import type { PlannerEdition, ReachVerdict, Shortlist } from "@powermysport/shared-types";

// Shapes mirror server/src/client/services/{PlannerService,SeasonPlanService}.ts and
// docs/plans/mobile-planner-contract.md. Dates on editions are ISO strings at midnight UTC;
// `official.*` dates are plain YYYY-MM-DD.

export type PlannerLinkState = "ready" | "not-linked" | "no-junior-standing";

export interface PlannerStanding {
  category: string;
  subcategory: string;
  rank: number | null;
  totalPoints: number | null;
  alsoRanked: Array<{ subcategory: string; rank: number }>;
  state: string | null;
  asOnDate: string;
}

export interface ExpectedEvent {
  name: string;
  city?: string;
  state?: string;
  ladder?: string;
  expectedMonth: string;
  month: string;
  lastYearStart: string;
}

export type EntryStatusValue = "shortlisted" | "entered" | "played";
export type SeasonGoal = "points" | "experience" | "home";

export interface EntryCosts {
  travel?: number;
  stay?: number;
  entryFee?: number;
}

export interface SeasonPlanEntry {
  editionSlug: string;
  name: string;
  startDate: string;
  status: EntryStatusValue;
  note?: string;
  costs?: EntryCosts;
  addedAt: string;
}

export interface BlockedRange {
  from: string;
  to: string;
  label?: string;
}

export interface SeasonPreferences {
  goal: SeasonGoal;
  blockedRanges: BlockedRange[];
  budget: number | null;
  includeOlderGroup: boolean;
}

export interface SeasonPlanData {
  dependentId: string;
  sportSlug: string;
  entries: SeasonPlanEntry[];
  preferences: SeasonPreferences;
  dismissed: string[];
}

export interface PlannerOverview {
  dependentId: string;
  dependentName: string;
  sportSlug: string;
  linkState: PlannerLinkState;
  standing: PlannerStanding | null;
  annualEntryCap: number | null;
  shortlist: Shortlist | null;
  reach?: Record<string, ReachVerdict>;
  expected?: ExpectedEvent[];
  plan: SeasonPlanData;
  editionsConsidered: number;
}

export type RecommendationTier = "recommended" | "consider" | "reach";

export interface RecommendationItem {
  slug: string;
  tier: RecommendationTier;
  reason: string;
  urgent?: boolean;
}

export interface Recommendations {
  source: "ai" | "rules";
  generatedAt: string;
  goal: SeasonGoal;
  summary: string;
  items: RecommendationItem[];
  notes: string[];
  stale: boolean;
  fallbackReason?: "ai-unavailable" | "invalid-output" | "daily-limit";
  unchanged?: boolean;
}

export interface RecommendationsResponse {
  ready: boolean;
  recommendations: Recommendations | null;
  usage: { used: number; cap: number };
}

export interface Money {
  low: number;
  high: number;
  basis: "estimate" | "yours";
}

export interface EventCost {
  slug: string;
  source: "ai" | "rough" | null;
  assumptions?: string;
  travel: Money | null;
  stay: Money | null;
  entryFee: number | null;
  entryFeeBasis: "yours" | "fact-sheet" | "rules" | null;
  total?: { low: number; high: number };
  entryFeeMissing: boolean;
  note: string | null;
}

export interface CostResponse {
  origin: { kind: "city" | "state" | "none"; city?: string; state?: string; label?: string };
  events: Record<string, EventCost>;
  season: {
    events: number;
    withoutFigures: number;
    total: { low: number; high: number } | null;
    budget: number | null;
    status: "within" | "may-exceed" | "over" | "none";
    missingEntryFees: number;
  };
}

export interface RankingClaim {
  id: string;
  dependentId: string;
  dependentName: string;
  sportSlug: string;
  federationCode: string;
  regNo: string;
  verifiedAt: string;
}

/** The server writes its error messages for parents, so show them as they come. */
export function apiMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === "string" && message ? message : fallback;
}

export function apiCode(err: unknown): string | undefined {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

const enc = encodeURIComponent;

export const plannerApi = {
  overview: async (childId: string): Promise<PlannerOverview> =>
    (await apiClient.get(`/planner/${childId}`)).data.data,

  recommendations: async (childId: string): Promise<RecommendationsResponse> =>
    (await apiClient.get(`/planner/${childId}/recommendations`)).data.data,

  suggest: async (childId: string, force: boolean): Promise<RecommendationsResponse> =>
    (await apiClient.post(`/planner/${childId}/recommendations`, { force })).data.data,

  costs: async (childId: string, slugs: string[]): Promise<CostResponse> =>
    (
      await apiClient.get(`/planner/${childId}/costs`, {
        params: slugs.length ? { slugs: slugs.join(",") } : undefined,
      })
    ).data.data,

  tourSeen: async (): Promise<boolean> =>
    (await apiClient.get("/planner/tour")).data.data.seen === true,

  setTourSeen: async (seen: boolean): Promise<void> => {
    await apiClient.put("/planner/tour", { seen });
  },

  setHomeCity: async (city: string): Promise<string> =>
    (await apiClient.put("/planner/home-city", { city })).data.data.city,

  // Every plan mutation answers with the whole plan, so callers replace their copy.
  addEntry: async (childId: string, editionSlug: string): Promise<SeasonPlanData> =>
    (await apiClient.post(`/season-plans/${childId}/entries`, { editionSlug })).data.data,

  updateEntry: async (
    childId: string,
    editionSlug: string,
    patch: { status?: EntryStatusValue; note?: string; costs?: EntryCosts | null }
  ): Promise<SeasonPlanData> =>
    (await apiClient.patch(`/season-plans/${childId}/entries/${enc(editionSlug)}`, patch)).data
      .data,

  removeEntry: async (childId: string, editionSlug: string): Promise<SeasonPlanData> =>
    (await apiClient.delete(`/season-plans/${childId}/entries/${enc(editionSlug)}`)).data.data,

  // Replaces the whole preferences object: always send every field.
  savePreferences: async (childId: string, prefs: SeasonPreferences): Promise<SeasonPlanData> =>
    (
      await apiClient.put(`/season-plans/${childId}/preferences`, {
        goal: prefs.goal,
        blockedRanges: prefs.blockedRanges,
        budget: prefs.budget,
        includeOlderGroup: prefs.includeOlderGroup,
      })
    ).data.data,

  dismiss: async (childId: string, editionSlug: string): Promise<SeasonPlanData> =>
    (await apiClient.post(`/season-plans/${childId}/dismissed`, { editionSlug })).data.data,

  restore: async (childId: string, editionSlug: string): Promise<SeasonPlanData> =>
    (await apiClient.delete(`/season-plans/${childId}/dismissed/${enc(editionSlug)}`)).data.data,

  claims: async (): Promise<RankingClaim[]> => (await apiClient.get("/ranking-claims")).data.data,

  // The date of birth goes in the request body only: never stored, logged or put in a URL.
  claim: async (input: {
    dependentId: string;
    regNo: string;
    dob: string;
    sportSlug?: string;
  }): Promise<RankingClaim> => (await apiClient.post("/ranking-claims", input)).data.data,

  unlink: async (linkId: string): Promise<void> => {
    await apiClient.delete(`/ranking-claims/${linkId}`);
  },
};
