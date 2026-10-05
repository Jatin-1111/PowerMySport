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
  subcategory: string;
  rank: number;
  totalPoints: number;
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
};
