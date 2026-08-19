import axiosInstance from "@/lib/api/axios";
import { ApiResponse, DiscoveryResponse } from "@/types";

// Caching lives in the query layer now (see src/lib/query/keys.ts); these are
// plain fetchers.
export const discoveryApi = {
  // Search for venues near a location or get paginated venue listings
  searchNearbyVenues: async (params: {
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    sport?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<DiscoveryResponse>> => {
    const queryParams: any = {
      radius: params.maxDistance || 100000,
    };

    // Only add coordinates if provided, otherwise get all listings
    if (params.latitude !== undefined && params.longitude !== undefined) {
      queryParams.lat = params.latitude;
      queryParams.lng = params.longitude;
    }

    if (params.sport) {
      queryParams.sport = params.sport;
    }

    if (params.page) {
      queryParams.page = params.page;
    }

    if (params.limit) {
      queryParams.limit = params.limit;
    }

    const response = await axiosInstance.get("/venues/discover", {
      params: queryParams,
    });
    return response.data;
  },

  // Search for coaches near a location or get coach listings
  searchNearbyCoaches: async (params: {
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    sport?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<DiscoveryResponse>> => {
    const queryParams: any = {
      radius: params.maxDistance || 100000,
    };

    if (params.latitude !== undefined && params.longitude !== undefined) {
      queryParams.lat = params.latitude;
      queryParams.lng = params.longitude;
    }

    if (params.sport) {
      queryParams.sport = params.sport;
    }

    if (params.page) {
      queryParams.page = params.page;
    }

    if (params.limit) {
      queryParams.limit = params.limit;
    }

    const response = await axiosInstance.get("/coaches/discover", {
      params: queryParams,
    });
    return response.data;
  },

  // Get venue details by ID
  getVenueById: async (id: string): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.get(`/venues/${id}`);
    return response.data;
  },

  // Get coach details by ID
  getCoachById: async (id: string): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.get(`/coaches/${id}`);
    return response.data;
  },
};
