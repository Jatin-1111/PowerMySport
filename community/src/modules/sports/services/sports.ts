import axiosInstance from "@/lib/api/axios";

export interface Sport {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  isVerified: boolean;
}

interface SportsResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface VerifyResponse {
  isValid: boolean;
  message: string;
}

export const sportsApi = {
  /**
   * Get all available sports
   */
  getAllSports: async (): Promise<Sport[]> => {
    try {
      const response =
        await axiosInstance.get<SportsResponse<Sport[]>>("/sports");
      return response.data.data || [];
    } catch (error) {
      console.error("Error fetching all sports:", error);
      return [];
    }
  },

  /**
   * Search sports by query
   */
  searchSports: async (query: string): Promise<Sport[]> => {
    try {
      if (!query.trim()) {
        return await sportsApi.getAllSports();
      }
      const response = await axiosInstance.get<SportsResponse<Sport[]>>(
        `/sports/search?q=${encodeURIComponent(query)}`,
      );
      return response.data.data || [];
    } catch (error) {
      console.error("Error searching sports:", error);
      return [];
    }
  },

  /**
   * Verify if a custom sport is valid using Gemini
   */
  verifySport: async (sportName: string): Promise<VerifyResponse> => {
    try {
      const response = await axiosInstance.post<SportsResponse<VerifyResponse>>(
        "/sports/verify",
        { sportName },
      );
      return response.data.data || { isValid: false, message: "Unknown error" };
    } catch (error) {
      console.error("Error verifying sport:", error);
      return { isValid: false, message: "Failed to verify sport" };
    }
  },

  /**
   * Add a custom sport (requires authentication)
   */
  addCustomSport: async (sportName: string): Promise<Sport | null> => {
    try {
      const response = await axiosInstance.post<SportsResponse<Sport>>(
        "/sports/add",
        { sportName },
      );
      return response.data.data || null;
    } catch (error) {
      console.error("Error adding custom sport:", error);
      throw error;
    }
  },
};
