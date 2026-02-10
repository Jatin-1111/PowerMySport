import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Coach, IAvailability } from "@/types";

export const coachApi = {
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
};

