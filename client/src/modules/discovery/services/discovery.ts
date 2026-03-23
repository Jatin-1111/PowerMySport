import axiosInstance from "@/lib/api/axios";
import { withRequestCache } from "@/lib/api/requestCache";
import { ApiResponse, DiscoveryResponse } from "@/types";

const DISCOVERY_LIST_TTL_MS = 60000;
const DISCOVERY_DETAIL_TTL_MS = 120000;

const buildDiscoveryListKey = (
  type: "venues" | "coaches",
  params: {
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    sport?: string;
    page?: number;
    limit?: number;
  },
) =>
  [
    `discovery:${type}`,
    String(params.latitude ?? ""),
    String(params.longitude ?? ""),
    String(params.maxDistance ?? ""),
    params.sport ?? "",
    String(params.page ?? ""),
    String(params.limit ?? ""),
  ].join(":");

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

    const cacheKey = buildDiscoveryListKey("venues", params);
    return withRequestCache(
      cacheKey,
      async () => {
        const response = await axiosInstance.get("/venues/discover", {
          params: queryParams,
        });
        return response.data;
      },
      DISCOVERY_LIST_TTL_MS,
    );
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

    const cacheKey = buildDiscoveryListKey("coaches", params);
    return withRequestCache(
      cacheKey,
      async () => {
        const response = await axiosInstance.get("/coaches/discover", {
          params: queryParams,
        });
        return response.data;
      },
      DISCOVERY_LIST_TTL_MS,
    );
  },

  // Get venue details by ID
  getVenueById: async (id: string): Promise<ApiResponse<any>> => {
    return withRequestCache(
      `discovery:venue:${id}`,
      async () => {
        const response = await axiosInstance.get(`/venues/${id}`);
        return response.data;
      },
      DISCOVERY_DETAIL_TTL_MS,
    );
  },

  // Get coach details by ID
  getCoachById: async (id: string): Promise<ApiResponse<any>> => {
    return withRequestCache(
      `discovery:coach:${id}`,
      async () => {
        const response = await axiosInstance.get(`/coaches/${id}`);
        return response.data;
      },
      DISCOVERY_DETAIL_TTL_MS,
    );
  },
};
