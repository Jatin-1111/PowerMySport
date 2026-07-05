import axiosInstance from "@/lib/api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PathwayLevel {
  level: number;
  label: string;
  title: string;
  description: string;
  keyFocus: string;
  ageRange: string;
  competitions: string;
  steps: string[];
  governingBody?: string;
  localResources?: {
    academies?: string[];
    facilities?: string[];
    governingBodies?: string[];
  };
  benchmarks?: {
    description: string;
    metrics: Array<{ metric: string; target: string }>;
  };
  trialInfo?: {
    typicalMonths: string;
    registrationProcess: string;
    eligibilityAge: string;
    selectionCriteria: string[];
    tips: string[];
  };
  injuryRisks?: {
    commonInjuries: string[];
    preventionTips: string[];
    warningSignsToWatch: string[];
  };
  talentSignals?: {
    physicalMarkers: string[];
    cognitiveMarkers: string[];
    behavioralMarkers: string[];
  };
  mentalSkillsFocus?: string[];
  coachSelectionGuide?: {
    mustHave: string[];
    niceToHave: string[];
    redFlags: string[];
    questionsToAsk: string[];
  };
  governmentSchemes?: Array<{
    name: string;
    body: string;
    eligibility: string;
    benefit: string;
    howToApply: string;
    verifiedAsOf?: string;
  }>;
  academicIntegration?: string;
  proactiveDocuments?: string[];
}

export interface Tournament {
  name: string;
  level: string;
  description: string;
  ageGroup: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
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
export interface PathwayExpertVerification {
  expertId: string;
  expertName: string;
  expertPhotoUrl?: string;
  verifiedAt: string;
  note?: string;
  expertCredential?: string;
}

export interface SportPathway {
  _id?: string;
  sportSlug: string;
  sportName: string;
  category?: string;
  state?: string;
  overview: string;
  levels: PathwayLevel[];
  tournaments: Tournament[];
  scholarships: Scholarship[];
  universities: University[];
  equipment: Equipment[];
  careers: Career[];
  isVerified: boolean;
  expertVerifications?: PathwayExpertVerification[];
  trustTier?: "unverified" | "admin_verified" | "expert_verified";
  lookupCount: number;
  lastRefreshedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Summary row for an expert's own "sports I can verify" queue — one row per
 * sport (not per state variant; the same sport can have several cached
 * pathway documents, one per Indian state, but verification is sport-wide).
 */
export interface ExpertVerifiablePathway {
  sportSlug: string;
  sportName: string;
  category?: string;
  overview: string;
  isVerified: boolean;
  lookupCount: number;
  /** How many separate state-variant pathway documents exist for this sport. */
  stateVariants: number;
  expertVerificationCount: number;
  verifiedByMe: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  source?: "db" | "generated";
  isStale?: boolean;
  entitiesReady?: boolean;
  data?: T;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const pathwayApi = {
  /**
   * Fetch (or generate) a pathway for a sport name.
   * Returns null when the input is not a valid sport.
   * If the cached pathway is stale, the server refreshes it in the background
   * and returns the cached version immediately (serve-stale-while-revalidating).
   */
  getPathway: async (
    sportName: string,
    childAge?: number,
    state?: string,
  ): Promise<{
    pathway: SportPathway;
    source: "db" | "generated";
    isStale?: boolean;
    entitiesReady?: boolean;
  } | null> => {
    try {
      const params = new URLSearchParams({ sport: sportName });
      if (childAge) params.append("age", String(childAge));
      if (state) params.append("state", state.trim());
      const resp = await axiosInstance.get<ApiResponse<SportPathway>>(
        `/pathways?${params.toString()}`,
      );
      if (resp.data.success && resp.data.data) {
        return {
          pathway: resp.data.data,
          source: resp.data.source ?? "db",
          isStale: resp.data.isStale,
          entitiesReady: resp.data.entitiesReady ?? true,
        };
      }
      return null;
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new Error(err.response.data?.message || "Not found");
      }
      throw err;
    }
  },

  /**
   * Fetch only tournaments/scholarships/universities for a sport.
   * The server waits for the scraper if they aren't cached yet.
   * Call this in parallel with getPathway when entitiesReady is false.
   */
  getEntities: async (
    sportName: string,
    childCity?: string,
  ): Promise<{ tournaments: Tournament[]; scholarships: Scholarship[]; universities: University[] } | null> => {
    try {
      const params = new URLSearchParams({ sport: sportName });
      if (childCity) params.append("city", childCity.trim());
      const resp = await axiosInstance.get<ApiResponse<{
        tournaments: Tournament[];
        scholarships: Scholarship[];
        universities: University[];
      }>>(`/pathways/entities?${params.toString()}`);
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Search cached pathways for autocomplete.
   */
  searchPathways: async (query: string): Promise<SportPathway[]> => {
    try {
      const resp = await axiosInstance.get<ApiResponse<SportPathway[]>>(
        `/pathways/search?q=${encodeURIComponent(query)}`,
      );
      return resp.data.data ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Admin: manually trigger refresh of a specific pathway cache key.
   */
  refreshPathway: async (cacheKey: string): Promise<SportPathway | null> => {
    try {
      const resp = await axiosInstance.post<ApiResponse<SportPathway>>(
        `/pathways/refresh`,
        { cacheKey },
      );
      return resp.data.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Admin: trigger a background refresh of all stale pathways.
   * Returns the number of pathways refreshed.
   */
  refreshStale: async (): Promise<{ refreshed: number }> => {
    try {
      const resp = await axiosInstance.post<{ success: boolean; refreshed: number }>(
        `/pathways/refresh-stale`,
      );
      return { refreshed: resp.data.refreshed ?? 0 };
    } catch {
      return { refreshed: 0 };
    }
  },

  /**
   * Expert-only: pathways matching sports on the logged-in expert's own
   * profile — the queue they can verify.
   */
  getForExpertVerification: async (): Promise<ExpertVerifiablePathway[]> => {
    const resp = await axiosInstance.get<ApiResponse<ExpertVerifiablePathway[]>>(
      `/pathways/expert/mine`,
    );
    return resp.data.data ?? [];
  },

  /**
   * Expert-only: add/update this expert's named verification credit for a
   * sport — applies to every state variant of that sport's pathway.
   */
  verifyAsExpert: async (
    sportSlug: string,
    note?: string,
  ): Promise<ApiResponse<PathwayExpertVerification>> => {
    const resp = await axiosInstance.post<ApiResponse<PathwayExpertVerification>>(
      `/pathways/expert/${sportSlug}/verify`,
      { note },
    );
    return resp.data;
  },

  /** Expert-only: remove this expert's own verification credit for a sport. */
  removeExpertVerification: async (
    sportSlug: string,
  ): Promise<ApiResponse<null>> => {
    const resp = await axiosInstance.delete<ApiResponse<null>>(
      `/pathways/expert/${sportSlug}/verify`,
    );
    return resp.data;
  },
};
