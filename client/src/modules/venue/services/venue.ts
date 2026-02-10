import { ApiResponse, Venue } from "@/types";
import axiosInstance from "@/lib/api/axios";

export const venueApi = {
  createVenue: async (data: {
    name: string;
    location: string | { type: string; coordinates: number[] };
    sports: string[];
    pricePerHour: number;
    amenities?: string[];
    description?: string;
    images?: string[];
    openingHours?: string;
  }): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.post("/venues", data);
    return response.data;
  },

  getAllVenues: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(`/venues?${params.toString()}`);
    return response.data;
  },

  getVenue: async (venueId: string): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.get(`/venues/${venueId}`);
    return response.data;
  },

  getMyVenues: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/venues/my-venues?${params.toString()}`,
    );
    return response.data;
  },

  searchVenues: async (filters?: {
    sports?: string[];
    location?: string;
    pagination?: {
      page?: number;
      limit?: number;
    };
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (filters?.sports) {
      filters.sports.forEach((sport) => params.append("sports", sport));
    }
    if (filters?.location) {
      params.append("location", filters.location);
    }
    if (filters?.pagination?.page) {
      params.append("page", filters.pagination.page.toString());
    }
    if (filters?.pagination?.limit) {
      params.append("limit", filters.pagination.limit.toString());
    }

    const response = await axiosInstance.get(
      `/venues/search?${params.toString()}`,
    );
    return response.data;
  },

  updateVenue: async (
    venueId: string,
    data:
      | Partial<Venue>
      | { location: { type: string; coordinates: number[] } },
  ): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.put(`/venues/${venueId}`, data);
    return response.data;
  },

  deleteVenue: async (venueId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/venues/${venueId}`);
    return response.data;
  },
};

