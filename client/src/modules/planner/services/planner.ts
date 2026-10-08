import axiosInstance from "@/lib/api/axios";
import type { PlannerEntry, Shortlist } from "@powermysport/shared-types";
import type { SeasonGoal, SeasonPlanData } from "@/modules/planner/services/seasonPlan";

/**
 * One child's planner, as the server assembles it.
 *
 * The verdicts arrive already judged. The browser used to fetch the calendar and
 * run the rules itself; it no longer does, because the assistant chat has to give
 * the same answer and the only way to guarantee that is for both to read one
 * server function. The rules still live in `shared-types`, so the types here are
 * the rules' own.
 */

export type PlannerLinkState = "ready" | "not-linked" | "no-junior-standing";

export interface PlannerStanding {
  category: string;
  /** The age group they play in, worked out from their birth year. */
  subcategory: string;
  /** Their rank in that age group's own list. Null if they are not ranked there yet. */
  rank: number | null;
  totalPoints: number | null;
  /** The other junior lists they are ranked in (a child who plays up), youngest first. */
  alsoRanked: Array<{ subcategory: string; rank: number }>;
  /** Where the player is registered, when the list records it. */
  state: string | null;
  asOnDate: string;
}

export interface PlannerOverview {
  dependentId: string;
  dependentName: string;
  sportSlug: string;
  linkState: PlannerLinkState;
  standing: PlannerStanding | null;
  /** Yearly entry allowance for the bracket. Null where AITA states none. */
  annualEntryCap: number | null;
  shortlist: Shortlist | null;
  plan: SeasonPlanData;
  editionsConsidered: number;
}

export type { PlannerEntry };

export type RecommendationTier = "recommended" | "consider";
export type RecommendationSource = "ai" | "rules";
export type FallbackReason = "ai-unavailable" | "invalid-output" | "daily-limit";

export interface RecommendationItem {
  slug: string;
  tier: RecommendationTier;
  reason: string;
}

export interface Recommendations {
  source: RecommendationSource;
  fallbackReason?: FallbackReason;
  generatedAt: string;
  goal: SeasonGoal;
  summary: string;
  items: RecommendationItem[];
  /** Plain facts about what was left out. */
  notes: string[];
  /** The child's list, plan or preferences changed after this was made. */
  stale: boolean;
}

export interface RecommendationUsage {
  used: number;
  cap: number;
}

export interface RecommendationResponse {
  /** False until the child has a ranking to plan against. */
  ready: boolean;
  recommendations: Recommendations | null;
  usage: RecommendationUsage;
}

export interface CostRange {
  low: number;
  high: number;
}

export type CostBasis = "estimate" | "yours";

export interface CostPart extends CostRange {
  basis: CostBasis;
}

export interface EventCost {
  slug: string;
  /** "rough" is the rule-of-thumb table, not the AI model. Null with no estimate. */
  source: "ai" | "rough" | null;
  assumptions: string | null;
  travel: CostPart | null;
  stay: CostPart | null;
  /**
   * The parent's own figure, else the singles fee AITA publishes for the event,
   * else null. We never estimate an entry fee.
   */
  entryFee: number | null;
  /** Whose figure it is. "fact-sheet" is the event's page, "rules" AITA's 2026 fee table. */
  entryFeeBasis: "yours" | "fact-sheet" | "rules" | null;
  total: CostRange | null;
  entryFeeMissing: boolean;
  /** Why there is no total, in words. */
  note: string | null;
}

export interface CostOrigin {
  kind: "city" | "state" | "none";
  city?: string;
  state?: string;
  label: string | null;
}

export type BudgetStatus = "within" | "may-exceed" | "over" | "none";

export interface SeasonCost {
  events: number;
  withoutFigures: number;
  total: CostRange | null;
  budget: number | null;
  status: BudgetStatus;
  missingEntryFees: number;
}

export interface CostResponse {
  origin: CostOrigin;
  events: Record<string, EventCost>;
  season: SeasonCost;
}

export const plannerApi = {
  async get(dependentId: string): Promise<PlannerOverview> {
    const { data } = await axiosInstance.get(`/planner/${dependentId}`);
    return data?.data;
  },

  /** The saved suggestions. Never calls the model and costs nothing. */
  async getRecommendations(dependentId: string): Promise<RecommendationResponse> {
    const { data } = await axiosInstance.get(`/planner/${dependentId}/recommendations`);
    return data?.data;
  },

  /**
   * Make suggestions, or reuse the saved ones when nothing has changed. `force`
   * asks for a fresh answer and spends one of the day's allowance.
   */
  async suggest(dependentId: string, force: boolean): Promise<RecommendationResponse> {
    const { data } = await axiosInstance.post(`/planner/${dependentId}/recommendations`, {
      force,
    });
    return data?.data;
  },

  /**
   * Travel and stay for the events on the plan, plus any named in `slugs`. The
   * server prices by route and caches, so asking again is cheap.
   */
  async getCosts(dependentId: string, slugs: string[]): Promise<CostResponse> {
    const { data } = await axiosInstance.get(`/planner/${dependentId}/costs`, {
      params: slugs.length > 0 ? { slugs: slugs.join(",") } : {},
    });
    return data?.data;
  },

  /** Whether this parent has already been through the planner's tour. */
  async getTourSeen(): Promise<boolean> {
    const { data } = await axiosInstance.get("/planner/tour");
    return data?.data?.seen === true;
  },

  /** Records the tour as seen, or as not seen to play it again. */
  async setTourSeen(seen: boolean): Promise<boolean> {
    const { data } = await axiosInstance.put("/planner/tour", { seen });
    return data?.data?.seen === true;
  },

  /** Saves the city on the parent's profile, where the estimates start from. */
  async saveHomeCity(city: string): Promise<string> {
    const { data } = await axiosInstance.put("/planner/home-city", { city });
    return data?.data?.city;
  },
};
