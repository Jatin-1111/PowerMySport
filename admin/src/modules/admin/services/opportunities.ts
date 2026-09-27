import axiosInstance from "@/lib/api/axios";
import type { ApiResponse } from "@/types";

// ─── Admissions & scholarships CMS client ───────────────────────────────────
//
// Mirrors server/src/admin/routes/opportunityAdminRoutes.ts. The record shape
// is owned by server/src/shared/validation/opportunityFormat.ts; the server
// validates every write against it and answers with pathed errors.

export type OpportunityTrack = "admission" | "scholarship";
export type OpportunityCycleState = "open" | "upcoming" | "closed" | "rolling";

export interface AdminOpportunity {
  _id: string;
  slug: string;
  track: OpportunityTrack;
  category: string;
  title: string;
  summary?: string;
  owner?: { name: string; type: string };
  sports?: string[];
  allSports?: boolean;
  geography?: { scope: string; state?: string };
  eligibility?: {
    ageMin?: number;
    ageMax?: number;
    ageNote?: string;
    gender?: string;
    level?: string;
    academic?: string;
    income?: string;
  };
  selection?: string;
  benefit?: {
    summary: string;
    amount?: { value: number; currency: string; period: string; note?: string };
  };
  cycle?: {
    label?: string;
    opensOn?: string;
    closesOn?: string;
    keyDates?: Array<{ label: string; date: string }>;
  };
  steps?: string[];
  keyFacts?: string[];
  applyUrl?: string;
  sources?: Array<{ label: string; url: string; publishedOn?: string }>;
  lastVerifiedOn?: string;
  verificationNote?: string;
  status: "draft" | "published";
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface AdminOpportunityRow {
  _id: string;
  slug: string;
  track: OpportunityTrack;
  category: string;
  title: string;
  status: "draft" | "published";
  lastVerifiedOn?: string;
  cycleState: OpportunityCycleState;
  stale: boolean;
  updatedAt: string;
}

/** What a save sends: the record without its server-owned fields. */
export type OpportunityPayload = Omit<
  AdminOpportunity,
  "_id" | "status" | "publishedAt" | "updatedAt" | "lastVerifiedOn"
>;

export const opportunityAdminApi = {
  list: async (): Promise<ApiResponse<AdminOpportunityRow[]>> =>
    (await axiosInstance.get("/admin/opportunities")).data,

  get: async (id: string): Promise<ApiResponse<AdminOpportunity>> =>
    (await axiosInstance.get(`/admin/opportunities/${id}`)).data,

  create: async (
    payload: Pick<OpportunityPayload, "slug" | "track" | "category" | "title">
  ): Promise<ApiResponse<AdminOpportunity>> =>
    (await axiosInstance.post("/admin/opportunities", payload)).data,

  update: async (id: string, payload: OpportunityPayload): Promise<ApiResponse<AdminOpportunity>> =>
    (await axiosInstance.put(`/admin/opportunities/${id}`, payload)).data,

  verify: async (id: string): Promise<ApiResponse<AdminOpportunity>> =>
    (await axiosInstance.post(`/admin/opportunities/${id}/verify`)).data,

  setStatus: async (
    id: string,
    status: "draft" | "published"
  ): Promise<ApiResponse<{ status: string; publishedAt: string | null }>> =>
    (await axiosInstance.post(`/admin/opportunities/${id}/status`, { status })).data,

  remove: async (id: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.delete(`/admin/opportunities/${id}`)).data,
};
