import axiosInstance from "@/lib/api/axios";
import type { ApiResponse, EarningsData } from "@/types";

/** What the venue analytics endpoint returns. Venues count customers, not clients. */
export interface VenueAnalyticsData {
  overview: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    totalCustomers: number;
    returningCustomers: number;
    retentionRate: number;
    avgRating: number;
    reviewCount: number;
  };
}

/** Earnings and analytics for the signed-in venue lister, across all their venues. */
export const venueConsoleApi = {
  getEarnings: async (): Promise<ApiResponse<EarningsData>> => {
    const response = await axiosInstance.get("/venues/earnings");
    return response.data;
  },

  getAnalytics: async (): Promise<ApiResponse<VenueAnalyticsData>> => {
    const response = await axiosInstance.get("/venues/analytics");
    return response.data;
  },
};
