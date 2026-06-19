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
}

export interface Tournament {
  name: string;
  level: string;
  description: string;
  ageGroup: string;
}

export interface Scholarship {
  name: string;
  provider: string;
  description: string;
  eligibility: string;
}

export interface University {
  name: string;
  location: string;
  admissionCriteria: string;
  sportsQuotaDetails: string;
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

export interface SportPathway {
  _id?: string;
  sportSlug: string;
  sportName: string;
  category?: string;
  overview: string;
  levels: PathwayLevel[];
  tournaments: Tournament[];
  scholarships: Scholarship[];
  universities: University[];
  equipment: Equipment[];
  careers: Career[];
  isVerified: boolean;
  lookupCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  source?: "db" | "generated";
  data?: T;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const pathwayApi = {
  /**
   * Fetch (or generate) a pathway for a sport name.
   * Returns null when the input is not a valid sport.
   */
  getPathway: async (
    sportName: string,
    childAge?: number,
    childCity?: string,
  ): Promise<{ pathway: SportPathway; source: "db" | "generated" } | null> => {
    try {
      const params = new URLSearchParams({ sport: sportName });
      if (childAge) params.append("age", String(childAge));
      if (childCity) params.append("city", childCity.trim());
      const resp = await axiosInstance.get<ApiResponse<SportPathway>>(
        `/pathways?${params.toString()}`,
      );
      if (resp.data.success && resp.data.data) {
        return {
          pathway: resp.data.data,
          source: resp.data.source ?? "db",
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
};
