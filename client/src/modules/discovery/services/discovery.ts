import axiosInstance from "@/lib/api/axios";
import { ApiResponse, DiscoveryResponse } from "@/types";

export const discoveryApi = {
  // Search for venues and coaches near a location or get all listings
  searchNearby: async (params: {
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    sport?: string;
  }): Promise<ApiResponse<DiscoveryResponse>> => {
    const queryParams: any = {
      maxDistance: params.maxDistance || 10,
    };

    // Only add coordinates if provided, otherwise get all listings
    if (params.latitude !== undefined && params.longitude !== undefined) {
      queryParams.latitude = params.latitude;
      queryParams.longitude = params.longitude;
    }

    if (params.sport) {
      queryParams.sport = params.sport;
    }

    const response = await axiosInstance.get("/venues/discover", {
      params: queryParams,
    });
    return response.data;
  },
};
