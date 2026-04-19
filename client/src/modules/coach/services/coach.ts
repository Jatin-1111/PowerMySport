import axiosInstance from "@/lib/api/axios";
import {
  ApiResponse,
  CoachPlan,
  CoachPlanBillingCycle,
  CoachSubscription,
  CoachSubscriptionOverrideRequest,
  Coach,
  CoachVerificationDocument,
  IAvailability,
} from "@/types";

export interface CoachVerificationUploadResponse {
  uploadUrl: string;
  downloadUrl: string;
  fileName: string;
  key: string;
}

interface PaginationResult {
  total: number;
  page: number;
  totalPages: number;
  limit?: number;
}

export const coachApi = {
  // Save verification step 1 (bio)
  saveVerificationStep1: async (payload: {
    bio: string;
    mobileNumber: string;
  }): Promise<ApiResponse<Coach | { bio: string; mobileNumber: string }>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step1",
      payload,
    );
    return response.data;
  },

  // Save verification step 2 (sports/profile)
  saveVerificationStep2: async (payload: {
    bio: string;
    sports: string[];
    certifications?: string[];
    hourlyRate: number;
    sportPricing?: Record<string, number>;
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    baseLocation?: {
      type: "Point";
      coordinates: [number, number];
    };
    serviceRadiusKm?: number;
    travelBufferTime?: number;
    ownVenueDetails?: {
      name: string;
      address: string;
      description?: string;
      openingHours?: string;
      images?: string[];
      imageS3Keys?: string[];
      coordinates?: [number, number];
      location?: {
        type: "Point";
        coordinates: [number, number];
      };
    };
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step2",
      payload,
    );
    return response.data;
  },

  // Submit verification step 3 (documents)
  submitVerificationStep3: async (payload: {
    documents?: CoachVerificationDocument[];
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step3",
      payload,
    );
    return response.data;
  },

  // Create coach profile
  createProfile: async (data: {
    bio: string;
    certifications: string[];
    sports: string[];
    hourlyRate: number;
    serviceMode: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    venueId?: string;
    serviceRadiusKm?: number;
    travelBufferTime?: number;
    availability: IAvailability[];
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post("/coaches", data);
    return response.data;
  },

  // Get current user's coach profile
  getMyProfile: async (): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.get("/coaches/my-profile");
    return response.data;
  },

  // Get coach by ID
  getCoachById: async (coachId: string): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.get(`/coaches/${coachId}`);
    return response.data;
  },

  // Update coach profile
  updateProfile: async (
    coachId: string,
    data: Partial<Coach>,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.put(`/coaches/${coachId}`, data);
    return response.data;
  },

  // Delete coach profile
  deleteProfile: async (coachId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/coaches/${coachId}`);
    return response.data;
  },

  // Check coach availability
  checkAvailability: async (
    coachId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<ApiResponse<{ available: boolean }>> => {
    const response = await axiosInstance.get(
      `/coaches/availability/${coachId}`,
      {
        params: { date, startTime, endTime },
      },
    );
    return response.data;
  },

  // Update current coach availability by sport
  updateMyAvailability: async (data: {
    availabilityBySport: Record<string, IAvailability[]>;
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.put(
      "/coaches/my-profile/availability",
      data,
    );
    return response.data;
  },

  // Submit verification documents
  submitVerification: async (payload: {
    documents: CoachVerificationDocument[];
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post("/coaches/verification", payload);
    return response.data;
  },

  // Get presigned upload URL for verification documents
  getVerificationUploadUrl: async (payload: {
    fileName: string;
    contentType: string;
    documentType: CoachVerificationDocument["type"];
    purpose?: "DOCUMENT" | "VENUE_IMAGE";
  }): Promise<ApiResponse<CoachVerificationUploadResponse>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/upload-url",
      payload,
    );
    return response.data;
  },

  listSubscriptionPlans: async (): Promise<
    ApiResponse<{ plans: CoachPlan[] }>
  > => {
    const response = await axiosInstance.get("/coaches/subscription/plans");
    return response.data;
  },

  getMySubscription: async (): Promise<
    ApiResponse<{ subscription: CoachSubscription | null }>
  > => {
    const response = await axiosInstance.get(
      "/coaches/subscription/my-subscription",
    );
    return response.data;
  },

  subscribeToPlan: async (payload: {
    planId: string;
    billingCycle?: CoachPlanBillingCycle;
  }): Promise<ApiResponse<{ subscription: CoachSubscription }>> => {
    const response = await axiosInstance.post(
      "/coaches/subscription/subscribe",
      payload,
    );
    return response.data;
  },

  cancelSubscription: async (payload?: {
    reason?: string;
  }): Promise<ApiResponse<{ subscription: CoachSubscription }>> => {
    const response = await axiosInstance.post(
      "/coaches/subscription/cancel",
      payload || {},
    );
    return response.data;
  },

  requestSubscriptionOverride: async (payload: {
    note: string;
    requestedPlanId?: string;
  }): Promise<ApiResponse<{ request: CoachSubscriptionOverrideRequest }>> => {
    const response = await axiosInstance.post(
      "/coaches/subscription/override-request",
      payload,
    );
    return response.data;
  },

  listMyOverrideRequests: async (params?: {
    status?: "PENDING" | "APPROVED" | "REJECTED";
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<{
      requests: CoachSubscriptionOverrideRequest[];
      pagination: PaginationResult;
    }>
  > => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const response = await axiosInstance.get(
      `/coaches/subscription/override-requests${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return response.data;
  },
};
