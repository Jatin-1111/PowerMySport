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

export interface SeasonPlanData {
  dependentId: string;
  sportSlug: string;
  entries: SeasonPlanEntry[];
}

const base = (dependentId: string) => `/season-plans/${dependentId}`;

export const seasonPlanApi = {
  async get(dependentId: string): Promise<SeasonPlanData> {
    const { data } = await axiosInstance.get(base(dependentId));
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
