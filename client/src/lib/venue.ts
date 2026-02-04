import axiosInstance from "./axios";
import { ApiResponse, Venue } from "@/types";

export const venueApi = {
  createVenue: async (data: {
    name: string;
    location: string;
    sports: string[];
    pricePerHour: number;
    amenities?: string[];
    description?: string;
    images?: string[];
  }): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.post("/venues", data);
    return response.data;
  },

  getAllVenues: async (): Promise<ApiResponse<Venue[]>> => {
    const response = await axiosInstance.get("/venues");
    return response.data;
  },

  getVenue: async (venueId: string): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.get(`/venues/${venueId}`);
    return response.data;
  },

  getMyVenues: async (): Promise<ApiResponse<Venue[]>> => {
    const response = await axiosInstance.get("/venues/my-venues");
    return response.data;
  },

  searchVenues: async (filters?: {
    sports?: string[];
    location?: string;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (filters?.sports) {
      filters.sports.forEach((sport) => params.append("sports", sport));
    }
    if (filters?.location) {
      params.append("location", filters.location);
    }
    const response = await axiosInstance.get(
      `/venues/search?${params.toString()}`,
    );
    return response.data;
  },

  updateVenue: async (
    venueId: string,
    data: Partial<Venue>,
  ): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.put(`/venues/${venueId}`, data);
    return response.data;
  },

  deleteVenue: async (venueId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/venues/${venueId}`);
    return response.data;
  },
};
