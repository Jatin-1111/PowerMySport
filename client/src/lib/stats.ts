import axiosInstance from "./axios";
import { ApiResponse, Venue, Booking } from "@/types";

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

  getAllVenues: async (): Promise<ApiResponse<Venue[]>> => {
    const response = await axiosInstance.get("/stats/venues");
    return response.data;
  },

  getAllBookings: async (): Promise<ApiResponse<Booking[]>> => {
    const response = await axiosInstance.get("/stats/bookings");
    return response.data;
  },
};
