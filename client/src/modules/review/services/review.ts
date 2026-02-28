import axiosInstance from "@/lib/api/axios";
import { ApiResponse, ReviewListData, ReviewItem } from "@/types";

export const reviewApi = {
  getReviewEligibility: async (params: {
    targetType: "VENUE" | "COACH";
    targetId: string;
  }): Promise<
    ApiResponse<{
      eligible: boolean;
      bookingId: string | null;
      reason?: string;
    }>
  > => {
    const response = await axiosInstance.get("/reviews/eligibility", {
      params,
    });
    return response.data;
  },

  getVenueReviews: async (
    venueId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<ReviewListData>> => {
    const response = await axiosInstance.get(`/reviews/venues/${venueId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  getCoachReviews: async (
    coachId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<ReviewListData>> => {
    const response = await axiosInstance.get(`/reviews/coaches/${coachId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  createReview: async (payload: {
    bookingId: string;
    targetType: "VENUE" | "COACH";
    targetId: string;
    rating: number;
    review?: string;
  }): Promise<ApiResponse<ReviewItem>> => {
    const response = await axiosInstance.post("/reviews", payload);
    return response.data;
  },
};
