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
    summary?: string;
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
  cost?: { kind: string; amount?: number; currency?: string; note?: string };
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
  /** The window's own dates, "YYYY-MM-DD", when the entry has them. */
  cycle?: { opensOn?: string; closesOn?: string };
  stale: boolean;
  updatedAt: string;
}

/** What a save sends: the record without its server-owned fields. */
export type OpportunityPayload = Omit<
  AdminOpportunity,
  "_id" | "status" | "publishedAt" | "updatedAt" | "lastVerifiedOn"
>;

/**
 * What the pre-publish check makes of an entry. A "problem" cannot be right and
 * should be fixed (the server refuses to publish past only a future verification
 * date); a "warning" is worth a look; a "note" is information.
 */
export interface PublishFinding {
  severity: "problem" | "warning" | "note";
  /** Where in the entry to look. */
  area: string;
  message: string;
}

export interface PublishCheckLink {
  url: string;
  label: string;
  /** "unchecked" means our server was turned away, not that the link is broken. */
  status: "ok" | "gone" | "moved" | "unchecked";
  note?: string;
}

export interface PublishCheck {
  findings: PublishFinding[];
  links: PublishCheckLink[];
}

export interface OpportunityQueueSummary {
  sources: number;
  /** Readable watched sources that changed. */
  changes: number;
  /** Watched sources our server cannot read that are due a hand check. */
  unreadable: number;
  leads: number;
  lastCheckedAt: string | null;
}

export const opportunityAdminApi = {
  list: async (): Promise<ApiResponse<AdminOpportunityRow[]>> =>
    (await axiosInstance.get("/admin/opportunities")).data,

  /** Counts for the three queue tiles; the lists load when a drawer opens. */
  queueSummary: async (): Promise<ApiResponse<OpportunityQueueSummary>> =>
    (await axiosInstance.get("/admin/opportunities/queue-summary")).data,

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
  ): Promise<
    ApiResponse<{ status: string; publishedAt: string | null; findings?: PublishFinding[] }>
  > => (await axiosInstance.post(`/admin/opportunities/${id}/status`, { status })).data,

  /** The pre-publish check on the saved entry. Opens its links, so it takes a few seconds. */
  check: async (id: string): Promise<ApiResponse<PublishCheck>> =>
    (await axiosInstance.post(`/admin/opportunities/${id}/check`)).data,

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
  updatedAt?: string;
  reviewedAt?: string;
  /** Raised by the weekly source check when a watched source changed. */
  autoDetected?: boolean;
  detectedChange?: "documents" | "text" | "file";
}

export interface OpportunitySource extends OpportunitySourceRow {
  extractedData?: Record<string, unknown>;
  citations?: Record<string, string>;
  citationChecks?: CitationChecks;
  /** Set when the page's documents were read too: every source and what became of it. */
  documents?: SourceDocumentRecord[];
  followDocuments?: boolean;
  extractionWarnings?: string[];
  extractionModel?: string;
  reviewNotes?: string;
  fileName?: string;
}

/**
 * "scattered" and "unmatched" only come from a PDF's text, which reads tables
 * out of order: they ask for a look, and never count as evidence against a row.
 */
export type QuoteStatus = "found" | "partial" | "missing" | "scattered" | "unmatched";

export interface ProposedChange {
  path: string;
  current: unknown;
  proposed: unknown;
  citation?: string;
  /** Whether the quote is on the page. Absent when it could not be checked (a PDF, a page read by the model alone). */
  quoteCheck?: QuoteStatus;
  /** Whether this row's number or date is in its quote. Absent for text. */
  figureCheck?: "ok" | "mismatch";
  /** How many fields were given this same quote, when it is several. */
  sharedQuote?: number;
  /** Which document this value was read from, when several were read. */
  from?: { url: string; label: string };
  /** What the other documents say about it, where they differ. */
  conflicts?: Array<{ url: string; label: string; value: unknown; quote?: string }>;
}

/** What was checked when the source was read; see server dataSourceExtraction/quoteCheck.ts. */
export interface CitationChecks {
  against: "page-text" | "pdf-text" | "none";
  quotes: Record<string, QuoteStatus>;
  figures: Record<string, "ok" | "mismatch">;
  shared: Record<string, number>;
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
  /** For a link to a page: also read the PDFs it links to, up to three. */
  followDocuments?: boolean;
}

/** One source read for a submission, and what became of it. */
export interface SourceDocumentRecord {
  url: string;
  label: string;
  kind: "page" | "document";
  status: "read" | "unreadable";
  sourcePublishedOn?: string;
  error?: string;
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
      status?: OpportunitySourceStatus | OpportunitySourceStatus[];
      opportunitySlug?: string;
    } = {}
  ): Promise<ApiResponse<OpportunitySourceRow[]>> =>
    (
      await axiosInstance.get("/admin/opportunity-sources", {
        params: {
          ...params,
          status: Array.isArray(params.status) ? params.status.join(",") : params.status,
        },
      })
    ).data,

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
  /** A change if the source can be read; if it cannot, whether it is due a hand check. */
  needsAttention: boolean;
  /** The last time anyone looked at it: a hand check, a dismissal, or a review of it. */
  lastLookedAt?: string | null;
  /** The last time a person opened it themselves, for a source our server cannot read. */
  lastManualCheckAt?: string;
  lastManualCheckNote?: string;
  entries: Array<{ id: string; slug: string; title: string; status: string }>;
}

/** An unreadable source is due a look again this long after anyone last looked (server MANUAL_CHECK_EVERY_DAYS). */
export const MANUAL_CHECK_EVERY_DAYS = 30;

export const opportunityWatchApi = {
  list: async (): Promise<ApiResponse<{ watches: SourceWatchRow[]; running: boolean }>> =>
    (await axiosInstance.get("/admin/opportunity-watch")).data,

  run: async (): Promise<ApiResponse<null>> =>
    (await axiosInstance.post("/admin/opportunity-watch/run")).data,

  dismiss: async (id: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.post(`/admin/opportunity-watch/${id}/dismiss`)).data,

  /** "I opened this source myself", for one our server cannot read. */
  manualCheck: async (
    id: string,
    note?: string
  ): Promise<ApiResponse<{ lastManualCheckAt: string }>> =>
    (await axiosInstance.post(`/admin/opportunity-watch/${id}/manual-check`, { note })).data,
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
  /** Set when triage dismissed it rather than a person. */
  autoDismissed?: boolean;
  dismissReason?: string;
  /** What triage made of it: advice for a person, never a decision. */
  triage?: {
    fit?: LeadFit;
    reason?: string;
    possibleDuplicateOf?: { slug: string; title: string };
    officialUrl?: string;
    by: "rules" | "ai";
  };
}

export type LeadFit = "high" | "medium" | "low" | "none";

export const opportunityLeadApi = {
  list: async (
    status: "new" | "read" | "dismissed" = "new",
    options: { autoDismissed?: boolean } = {}
  ): Promise<ApiResponse<{ leads: OpportunityLeadRow[]; running: boolean; triaging: boolean }>> =>
    (
      await axiosInstance.get("/admin/opportunity-leads", {
        params: { status, ...(options.autoDismissed ? { autoDismissed: true } : {}) },
      })
    ).data,

  run: async (): Promise<ApiResponse<null>> =>
    (await axiosInstance.post("/admin/opportunity-leads/run")).data,

  /** Sort the leads not yet looked at. Answers at once; the work takes a minute or two. */
  triage: async (): Promise<ApiResponse<null>> =>
    (await axiosInstance.post("/admin/opportunity-leads/triage")).data,

  /** Undo an automatic dismissal. */
  restore: async (id: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.post(`/admin/opportunity-leads/${id}/restore`)).data,

  dismiss: async (id: string, reason?: string): Promise<ApiResponse<null>> =>
    (await axiosInstance.post(`/admin/opportunity-leads/${id}/dismiss`, { reason })).data,
};
