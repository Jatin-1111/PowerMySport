import axiosInstance from "@/lib/api/axios";

export interface UserPathwayProfile {
  progress: {
    currentLevel: number;
    completedSteps: Record<string, boolean[]>;
  };
  savedItems: any[];
  applications: any[];
  reminders: any[];
}

export interface AthleteStory {
  _id: string;
  sportSlug: string;
  level: number;
  name: string;
  location: string;
  achievement: string;
  quote: string;
  parentNote: string;
  tags: string[];
  isAiGenerated?: boolean;
  sourceUrls?: string[];
}

export const roadmapProfileApi = {
  // dependentId scopes saved items/progress/applications to one child — pass
  // the id of the currently-selected dependent, or omit it for the "no
  // specific child" bucket (guests, or a parent who hasn't picked one yet).
  getProfile: async (dependentId?: string | null): Promise<UserPathwayProfile | null> => {
    try {
      const resp = await axiosInstance.get<{
        success: boolean;
        data: UserPathwayProfile;
      }>("/roadmap-profile", {
        params: dependentId ? { dependentId } : undefined,
      });
      return resp.data.data;
    } catch {
      return null;
    }
  },

  updateProfile: async (
    data: Partial<UserPathwayProfile>,
    dependentId?: string | null,
  ): Promise<UserPathwayProfile | null> => {
    try {
      const resp = await axiosInstance.put<{
        success: boolean;
        data: UserPathwayProfile;
      }>("/roadmap-profile", { ...data, dependentId: dependentId ?? undefined });
      return resp.data.data;
    } catch {
      return null;
    }
  },

  getStories: async (
    sport: string,
    level?: number,
    state?: string,
  ): Promise<AthleteStory[]> => {
    try {
      let url = `/pathways/stories?sport=${encodeURIComponent(sport)}`;
      if (level) url += `&level=${level}`;
      if (state) url += `&state=${encodeURIComponent(state)}`;
      const resp = await axiosInstance.get<{
        success: boolean;
        data: AthleteStory[];
      }>(url);
      return resp.data.data ?? [];
    } catch {
      return [];
    }
  },
};
