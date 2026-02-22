import axiosInstance from "@/lib/api/axios";
import {
  ApiResponse,
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
    ownVenueDetails?: {
      name: string;
      address: string;
      description?: string;
      openingHours?: string;
      coordinates?: [number, number];
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
    documents: CoachVerificationDocument[];
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
  }): Promise<ApiResponse<CoachVerificationUploadResponse>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/upload-url",
      payload,
    );
    return response.data;
  },
};
