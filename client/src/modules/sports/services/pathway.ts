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

export interface SportPathway {
  _id?: string;
  sportSlug: string;
  sportName: string;
  category?: string;
  overview: string;
  levels: PathwayLevel[];
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
  ): Promise<{ pathway: SportPathway; source: "db" | "generated" } | null> => {
    try {
      const resp = await axiosInstance.get<ApiResponse<SportPathway>>(
        `/pathways?sport=${encodeURIComponent(sportName)}`,
      );
      if (resp.data.success && resp.data.data) {
        return {
          pathway: resp.data.data,
          source: resp.data.source ?? "db",
        };
      }
      return null;
    } catch (err: unknown) {
      // 404 = not a sport — surface that distinction
      if ((err as { response?: { status?: number } })?.response?.status === 404)
        return null;
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
