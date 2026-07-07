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

export const pathwayProfileApi = {
  getProfile: async (): Promise<UserPathwayProfile | null> => {
    try {
      const resp = await axiosInstance.get<{
        success: boolean;
        data: UserPathwayProfile;
      }>("/pathway-profile");
      return resp.data.data;
    } catch {
      return null;
    }
  },

  updateProfile: async (
    data: Partial<UserPathwayProfile>,
  ): Promise<UserPathwayProfile | null> => {
    try {
      const resp = await axiosInstance.put<{
        success: boolean;
        data: UserPathwayProfile;
      }>("/pathway-profile", data);
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
