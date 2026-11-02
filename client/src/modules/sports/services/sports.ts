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

export const sportsApi = {
  /**
   * The sports parents can filter by on the booking pages: the supported sports
   * plus any other sport a listed provider really offers.
   */
  getDiscoverySports: async (): Promise<Sport[]> => {
    try {
      const response = await axiosInstance.get<SportsResponse<Sport[]>>("/sports/discovery");
      return response.data.data || [];
    } catch (error) {
      console.error("Error fetching discovery sports:", error);
      return [];
    }
  },

  /**
   * Get all available sports
   */
  getAllSports: async (): Promise<Sport[]> => {
    try {
      const response = await axiosInstance.get<SportsResponse<Sport[]>>("/sports");
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
        `/sports/search?q=${encodeURIComponent(query)}`
      );
      return response.data.data || [];
    } catch (error) {
      console.error("Error searching sports:", error);
      return [];
    }
  },
};
