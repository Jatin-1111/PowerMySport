import axiosInstance from "@/lib/api/axios";

/**
 * A child's tournament plan.
 *
 * Every call returns the whole plan rather than the entry it touched, so the
 * cache is replaced with the server's version instead of being patched from a
 * guess about what the write did. A plan is a handful of entries, so there is
 * nothing to save by sending less.
 */

export type SeasonPlanEntryStatus = "shortlisted" | "entered" | "played";

export interface SeasonPlanEntry {
  editionSlug: string;
  /** Captured when the tournament was planned — see the model's note on why. */
  name: string;
  startDate: string;
  status: SeasonPlanEntryStatus;
  note?: string;
  addedAt: string;
}

/**
 * What the parent wants the season to be for. Mirrors the server's list, which is
 * the only list the recommender is built to serve.
 */
export type SeasonGoal = "points" | "experience" | "home";

/** Whole calendar days, `YYYY-MM-DD`, both ends included. */
export interface BlockedRange {
  from: string;
  to: string;
  label?: string;
}

export interface PlanPreferences {
  goal: SeasonGoal;
  blockedRanges: BlockedRange[];
}

/** The most blocked ranges a plan holds. The server enforces the same number. */
export const MAX_BLOCKED_RANGES = 5;

export interface SeasonPlanData {
  dependentId: string;
  sportSlug: string;
  entries: SeasonPlanEntry[];
  preferences: PlanPreferences;
}

const base = (dependentId: string) => `/season-plans/${dependentId}`;

export const seasonPlanApi = {
  async get(dependentId: string): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.get(base(dependentId));
    return data?.data;
  },

  async setPreferences(dependentId: string, preferences: PlanPreferences): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.put(`${base(dependentId)}/preferences`, preferences);
    return data?.data;
  },

  async add(dependentId: string, editionSlug: string): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.post(`${base(dependentId)}/entries`, { editionSlug });
    return data?.data;
  },

  async setStatus(
    dependentId: string,
    editionSlug: string,
    status: SeasonPlanEntryStatus
  ): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.patch(
      `${base(dependentId)}/entries/${encodeURIComponent(editionSlug)}`,
      { status }
    );
    return data?.data;
  },

  async remove(dependentId: string, editionSlug: string): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.delete(
      `${base(dependentId)}/entries/${encodeURIComponent(editionSlug)}`
    );
    return data?.data;
  },
};

/** How a status reads to the parent who set it. */
export const STATUS_LABEL: Record<SeasonPlanEntryStatus, string> = {
  shortlisted: "Shortlisted",
  entered: "Entered",
  played: "Played",
};

/** The next step along, or null once there is nowhere further to go. */
export const nextStatus = (status: SeasonPlanEntryStatus): SeasonPlanEntryStatus | null =>
  status === "shortlisted" ? "entered" : status === "entered" ? "played" : null;
