import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Booking, Venue } from "@/types";

const STATS_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface PlatformStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  pendingInquiries: number;
  revenue: number;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

export const statsApi = {
  trackFunnelEvent: async (payload: {
    eventName: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    source?: "WEB" | "MOBILE" | "SERVER";
  }): Promise<{ success: boolean; message: string }> => {
    const response = await axiosInstance.post("/stats/funnel/event", payload);
    return response.data;
  },

  // Use this for link clicks/navigation flows where axios interceptors can disrupt UX.
  trackFunnelEventNonBlocking: (payload: {
    eventName: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    source?: "WEB" | "MOBILE" | "SERVER";
  }): void => {
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");

    void fetch(`${STATS_API_BASE_URL}/stats/funnel/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  },

  getPlatformStats: async (): Promise<ApiResponse<PlatformStats>> => {
    const response = await axiosInstance.get("/stats/platform");
    return response.data;
  },

  getAllUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<UserData[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users?${params.toString()}`,
    );
    return response.data;
  },

  getAllVenues: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/venues?${params.toString()}`,
    );
    return response.data;
  },

  getAllBookings: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Booking[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/bookings?${params.toString()}`,
    );
    return response.data;
  },
};
