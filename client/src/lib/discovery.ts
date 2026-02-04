import axiosInstance from "./axios";
import { ApiResponse, DiscoveryResponse } from "@/types";

export const discoveryApi = {
  // Search for venues and coaches near a location
  searchNearby: async (params: {
    latitude: number;
    longitude: number;
    maxDistance?: number;
    sport?: string;
  }): Promise<ApiResponse<DiscoveryResponse>> => {
    const response = await axiosInstance.get("/venues/discover", {
      params: {
        latitude: params.latitude,
        longitude: params.longitude,
        maxDistance: params.maxDistance || 10,
        sport: params.sport,
      },
    });
    return response.data;
  },
};
