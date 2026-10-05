import axiosInstance from "@/lib/api/axios";
import type { PlannerEntry, Shortlist } from "@powermysport/shared-types";
import type { SeasonPlanData } from "@/modules/planner/services/seasonPlan";

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

export const plannerApi = {
  async get(dependentId: string): Promise<PlannerOverview> {
    const { data } = await axiosInstance.get(`/planner/${dependentId}`);
    return data?.data;
  },
};
