import axiosInstance from "@/lib/api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

// FederationInfo and Tournament now live in @powermysport/shared-types —
// this was the only Tournament type outside the server model; admin and
// community had none at all despite admin having a tournament-facing UI.
export type { FederationInfo } from "@powermysport/shared-types";
import type { Tournament as SharedTournament } from "@powermysport/shared-types";

/** `_id` kept for compatibility with any existing reference to it, alongside
 *  the shared type's `id`. */
export interface Tournament extends SharedTournament {
  _id?: string;
}

export interface Scholarship {
  name: string;
  provider: string;
  description: string;
  eligibility: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
}

export interface University {
  name: string;
  location: string;
  admissionCriteria: string;
  sportsQuotaDetails: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
}

export interface Equipment {
  level: string;
  items: string[];
  estimatedCost: string;
}

export interface Career {
  role: string;
  description: string;
  demand: string;
}

/** A named credit from an expert who verified this pathway matches their domain. */
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  source?: "db" | "generated";
  isStale?: boolean;
  entitiesReady?: boolean;
  data?: T;
  // returned when the sport is real but not yet supported on the platform
  status?: string;
  sport?: string;
  supportedSports?: Array<{ slug: string; name: string }>;
}

// ─── Pathway guide ───────────────────────────────────────────────────────────
//
// Mirrors `server/src/shared/validation/pathwayGuideFormat.ts`. Every stage
// answers the same five questions in the same order — that repetition is the
// product, not an accident of the schema.

export interface PathwayAction {
  label: string;
  href?: string;
}

/** Bucket 2. No `answer` means the question is listed but not yet written. */
export interface PathwayQuestion {
  question: string;
  answer?: string;
}

/** Buckets 3 and 4 — "what to look for" and "decisions" — share this shape. */
export interface PathwayPoint {
  title: string;
  detail?: string;
}

/** Bucket 5. `when` is a situation ("Not started") or an order ("Step 1"). */
export interface PathwayNextStep {
  when: string;
  action: string;
}

export interface PathwayStage {
  key: string;
  order: number;
  name: string;
  ageRange: string;
  coreQuestion: string;
  overview: string;
  questions: PathwayQuestion[];
  signals: PathwayPoint[];
  decisions: PathwayPoint[];
  nextStepLead?: string;
  nextSteps: PathwayNextStep[];
  primaryAction?: PathwayAction;
  helpLinks: PathwayAction[];
}

export interface PathwayGuide {
  sportSlug: string;
  sportName: string;
  formatVersion: number;
  intro: { eyebrow?: string; headline?: string; description?: string };
  sportIntro: string[];
  reviewedOn: string | null;
  updatedAt?: string;
  stages: PathwayStage[];
}

/** The stage fields the picker needs. Everything long stays in the full guide. */
export type PathwayStageSummary = Pick<PathwayStage, "key" | "name" | "ageRange" | "coreQuestion">;

export interface PathwayGuideSummary {
  sportSlug: string;
  sportName: string;
  stageCount: number;
  /**
   * Present since the picker started pointing parents at a stage rather than at
   * a sport. Optional because a cached or older response may not carry it, and
   * a sport with no stage list degrades to a plain link rather than an error.
   */
  stages?: PathwayStageSummary[];
  updatedAt?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const pathwayApi = {
  /**
   * The published pathway for a sport: the intro copy plus every stage.
   *
   * 404 is a normal answer — only sports whose pathway has been written and
   * published in the CMS have one — so a miss returns null and the caller shows
   * a "not ready yet" state rather than an error.
   */
  getPathwayGuide: async (sport: string): Promise<PathwayGuide | null> => {
    try {
      const q = new URLSearchParams({ sport });
      const resp = await axiosInstance.get<ApiResponse<PathwayGuide>>(
        `/pathways/guide?${q.toString()}`
      );
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },

  /** Which sports a parent can actually read a pathway for. */
  listPathwayGuides: async (): Promise<PathwayGuideSummary[]> => {
    try {
      const resp = await axiosInstance.get<ApiResponse<PathwayGuideSummary[]>>("/pathways/guides");
      return resp.data.data ?? [];
    } catch {
      return [];
    }
  },

  /** Fetch all curated tournaments, optionally filtered by sportSlug. */
  getCuratedTournaments: async (sportSlug?: string): Promise<Tournament[]> => {
    try {
      const params = sportSlug ? `?sport=${encodeURIComponent(sportSlug)}` : "";
      const resp = await axiosInstance.get<ApiResponse<Tournament[]>>(
        `/pathways/tournaments${params}`
      );
      return resp.data.data ?? [];
    } catch {
      return [];
    }
  },
};

// ─── Federation types ─────────────────────────────────────────────────────────

export interface FederationEligibilityCategory {
  name: string;
  maxAge: number;
  genders: string[];
  minRanking?: string;
  notes?: string;
}

export interface FederationEligibilityCriteria {
  ageCutoffRule?: string;
  categories: FederationEligibilityCategory[];
  registrationRequired: boolean;
  stateAssociationFirst: boolean;
  notes?: string;
}

export interface FederationStateAssociation {
  name: string;
  state: string;
  website?: string;
}

export interface Federation {
  _id: string;
  slug: string;
  name: string;
  acronym: string;
  sportSlug: string;
  type: "govt" | "national" | "hybrid";
  about: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  officialCalendarUrl?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  affiliations?: string[];
  stateAssociations?: FederationStateAssociation[];
  keyFacts?: string[];
  eligibilityCriteria?: FederationEligibilityCriteria;
  registrationSteps?: string[];
  requiredDocuments?: string[];
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  dataVerifiedAt?: string;
  sourceUrls?: string[];
}

export interface FederationTournamentsResponse {
  tournaments: Tournament[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export type EditionDocumentKind =
  "factSheet" | "acceptanceList" | "entryForm" | "draw" | "results" | "other";

export interface EditionDocument {
  label: string;
  url: string;
  kind: EditionDocumentKind;
}

export interface TournamentEdition {
  _id?: string;
  sportSlug: string;
  name: string;
  /** Present on editions approved after the detail page shipped; absent ones simply don't link out. */
  slug?: string;
  editionYear: number;
  startDate: string;
  endDate?: string;
  registrationDeadlineDate?: string;
  venue?: string;
  city?: string;
  level?: string;
  ageGroups?: string[];
  sourceUrl: string;
  status: "announced" | "ongoing" | "completed" | "cancelled";
  lastCheckedAt: string;

  // ── From the event's own page on the federation site ──
  /** The federation's page for this event — the durable link when a signed document URL expires */
  detailUrl?: string;
  officialName?: string;
  organiser?: string;
  state?: string;
  category?: string;
  documents?: EditionDocument[];
}

/** A trimmed edition used for cross-links, not a full record. */
export interface RelatedEdition {
  _id?: string;
  slug: string;
  name: string;
  startDate: string;
  city?: string;
  venue?: string;
  level?: string;
  ageGroups?: string[];
}

export interface TournamentEditionDetail {
  edition: TournamentEdition;
  federation: { slug: string; name: string; acronym: string } | null;
  related: RelatedEdition[];
}

export interface FederationEditionsResponse {
  editions: TournamentEdition[];
  lastCheckedAt: string | null;
}

export const federationApi = {
  listBySport: async (sportSlug: string): Promise<Federation[]> => {
    try {
      const resp = await axiosInstance.get<ApiResponse<Federation[]>>(
        `/federations?sport=${encodeURIComponent(sportSlug)}`
      );
      return resp.data.data ?? [];
    } catch {
      return [];
    }
  },

  getBySlug: async (slug: string): Promise<Federation | null> => {
    try {
      const resp = await axiosInstance.get<ApiResponse<Federation>>(
        `/federations/${encodeURIComponent(slug)}`
      );
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },

  getTournaments: async (
    slug: string,
    params?: { level?: string; ageGroup?: string; page?: number; limit?: number }
  ): Promise<FederationTournamentsResponse | null> => {
    try {
      const qs = new URLSearchParams();
      if (params?.level) qs.set("level", params.level);
      if (params?.ageGroup) qs.set("ageGroup", params.ageGroup);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const resp = await axiosInstance.get<ApiResponse<FederationTournamentsResponse>>(
        `/federations/${encodeURIComponent(slug)}/tournaments?${qs.toString()}`
      );
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },

  getEditions: async (
    slug: string,
    params?: { limit?: number }
  ): Promise<FederationEditionsResponse | null> => {
    try {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      const resp = await axiosInstance.get<ApiResponse<FederationEditionsResponse>>(
        `/federations/${encodeURIComponent(slug)}/editions?${qs.toString()}`
      );
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },
};
