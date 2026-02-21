import axiosInstance from "@/lib/api/axios";
import {
  ApiResponse,
  Availability,
  Booking,
  InitiateBookingResponse,
} from "@/types";

export const bookingApi = {
  // Initiate booking with split payments
  initiateBooking: async (data: {
    venueId: string;
    coachId?: string;
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
    dependentId?: string;
  }): Promise<InitiateBookingResponse> => {
    const response = await axiosInstance.post("/bookings/initiate", data);
    return response.data.data;
  },

  // Get user's bookings
  getMyBookings: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Booking[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/bookings/my-bookings?${params.toString()}`,
    );
    return response.data;
  },

  // Get venue availability
  getVenueAvailability: async (
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

  // Get coach availability
  getCoachAvailability: async (
    coachId: string,
    date: string,
    sport?: string,
  ): Promise<ApiResponse<Availability>> => {
    const response = await axiosInstance.get(
      `/coaches/availability/${coachId}`,
      {
        params: { date, sport },
      },
    );
    return response.data;
  },

  // Cancel booking
  cancelBooking: async (bookingId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/bookings/${bookingId}`);
    return response.data;
  },

  // Verify booking with QR code
  verifyBooking: async (token: string): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.get(`/bookings/verify/${token}`);
    return response.data;
  },
};
