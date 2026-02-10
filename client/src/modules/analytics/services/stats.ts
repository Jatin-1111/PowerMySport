import { ApiResponse, Booking, Venue } from "@/types";
import axiosInstance from "@/lib/api/axios";

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
  getPlatformStats: async (): Promise<ApiResponse<PlatformStats>> => {
    const response = await axiosInstance.get("/stats/platform");
    return response.data;
  },

  getAllUsers: async (): Promise<ApiResponse<UserData[]>> => {
    const response = await axiosInstance.get("/stats/users");
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

