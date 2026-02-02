import axiosInstance from "./axios";
import { ApiResponse, Booking, Availability } from "@/types";

export const bookingApi = {
  createBooking: async (data: {
    venueId: string;
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post("/bookings", data);
    return response.data;
  },

  getMyBookings: async (): Promise<ApiResponse<Booking[]>> => {
    const response = await axiosInstance.get("/bookings/my-bookings");
    return response.data;
  },

  getAvailability: async (
    venueId: string,
    date: string,
  ): Promise<ApiResponse<Availability>> => {
    const response = await axiosInstance.get(
      `/bookings/availability/${venueId}`,
      {
        params: { date },
      },
    );
    return response.data;
  },

  cancelBooking: async (bookingId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/bookings/${bookingId}`);
    return response.data;
  },
};
