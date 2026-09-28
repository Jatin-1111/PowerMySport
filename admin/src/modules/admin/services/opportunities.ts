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
  watchUrls?: string[];
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

// ─── Reading an entry from a link or PDF ─────────────────────────────────────
// Mirrors server/src/admin/routes/opportunitySourceAdminRoutes.ts.

export type OpportunitySourceStatus =
  "PENDING_EXTRACTION" | "EXTRACTION_FAILED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface OpportunitySourceRow {
  _id: string;
  status: OpportunitySourceStatus;
  opportunitySlug?: string;
  opportunityTrack?: OpportunityTrack;
  sourceLabel?: string;
  sourceKind: "LINK" | "PDF";
  sourceUrl?: string;
  originUrl?: string;
  extractionError?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface OpportunitySource extends OpportunitySourceRow {
  extractedData?: Record<string, unknown>;
  citations?: Record<string, string>;
  extractionWarnings?: string[];
  extractionModel?: string;
  reviewNotes?: string;
  fileName?: string;
}

export interface ProposedChange {
  path: string;
  current: unknown;
  proposed: unknown;
  citation?: string;
}

export interface OpportunitySourceDetail {
  submission: OpportunitySource;
  entry: AdminOpportunity | null;
  entryMissing: boolean;
  changes: ProposedChange[];
}

export interface CreateOpportunitySourcePayload {
  opportunitySlug?: string;
  track?: OpportunityTrack;
  sportSlug?: string;
  sourceLabel: string;
  sourceKind: "LINK" | "PDF";
  sourceUrl?: string;
  s3Key?: string;
  fileName?: string;
  originUrl?: string;
  /** A lead being read; the server marks it read. */
  leadId?: string;
}

export const opportunitySourceApi = {
  uploadUrl: async (
    fileName: string
  ): Promise<ApiResponse<{ uploadUrl: string; key: string; fileName: string }>> =>
    (
      await axiosInstance.post("/admin/opportunity-sources/upload-url", {
        fileName,
        contentType: "application/pdf",
      })
    ).data,

  create: async (
    payload: CreateOpportunitySourcePayload
  ): Promise<ApiResponse<OpportunitySource>> =>
    (await axiosInstance.post("/admin/opportunity-sources", payload)).data,

  list: async (
    params: {
      status?: OpportunitySourceStatus;
      opportunitySlug?: string;
    } = {}
  ): Promise<ApiResponse<OpportunitySourceRow[]>> =>
    (await axiosInstance.get("/admin/opportunity-sources", { params })).data,

  get: async (id: string): Promise<ApiResponse<OpportunitySourceDetail>> =>
    (await axiosInstance.get(`/admin/opportunity-sources/${id}`)).data,

  edit: async (
    id: string,
    fields: Record<string, unknown>
  ): Promise<ApiResponse<OpportunitySource>> =>
    (await axiosInstance.patch(`/admin/opportunity-sources/${id}`, { fields })).data,

  reExtract: async (id: string): Promise<ApiResponse<OpportunitySource>> =>
    (await axiosInstance.post(`/admin/opportunity-sources/${id}/re-extract`)).data,

  reject: async (id: string, reason: string): Promise<ApiResponse<OpportunitySource>> =>
    (await axiosInstance.post(`/admin/opportunity-sources/${id}/reject`, { reason })).data,

  approve: async (id: string, keep: string[]): Promise<ApiResponse<{ opportunityId: string }>> =>
    (await axiosInstance.post(`/admin/opportunity-sources/${id}/approve`, { keep })).data,
};

// ─── The weekly source watch ─────────────────────────────────────────────────
// Mirrors server/src/admin/routes/opportunityWatchAdminRoutes.ts.

export type SourceWatchStatus = "ok" | "blocked" | "moved" | "gone" | "disallowed" | "error";

export interface SourceWatchRow {
  _id: string;
  url: string;
  status: SourceWatchStatus;
  httpStatus?: number;
  finalUrl?: string;
  note?: string;
  changeKind?: "documents" | "text" | "file";
  documentLinkCount?: number;
  lastCheckedAt: string;
  lastChangedAt?: string;
  statusSince: string;
  needsAttention: boolean;
  entries: Array<{ id: string; slug: string; title: string; status: string }>;
}

export const opportunityWatchApi = {
  list: async (): Promise<ApiResponse<{ watches: SourceWatchRow[]; running: boolean }>> =>
    (await axiosInstance.get("/admin/opportunity-watch")).data,

  run: async (): Promise<ApiResponse<null>> =>
    (await axiosInstance.post("/admin/opportunity-watch/run")).data,

  dismiss: async (id: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.post(`/admin/opportunity-watch/${id}/dismiss`)).data,
};

// ─── Leads from the monthly web search ───────────────────────────────────────
// Mirrors server/src/admin/routes/opportunityLeadAdminRoutes.ts.

export interface OpportunityLeadRow {
  _id: string;
  name: string;
  owner?: string;
  track: OpportunityTrack;
  why?: string;
  url: string;
  domain: string;
  isAggregator: boolean;
  query: string;
  sportSlug?: string;
  status: "new" | "read" | "dismissed";
  firstFoundAt: string;
  lastFoundAt: string;
  timesFound: number;
}

export const opportunityLeadApi = {
  list: async (
    status: "new" | "read" | "dismissed" = "new"
  ): Promise<ApiResponse<{ leads: OpportunityLeadRow[]; running: boolean }>> =>
    (await axiosInstance.get("/admin/opportunity-leads", { params: { status } })).data,

  run: async (): Promise<ApiResponse<null>> =>
    (await axiosInstance.post("/admin/opportunity-leads/run")).data,

  dismiss: async (id: string, reason?: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.post(`/admin/opportunity-leads/${id}/dismiss`, { reason })).data,
};
