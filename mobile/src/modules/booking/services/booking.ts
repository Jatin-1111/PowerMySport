import apiClient from '@lib/api/axios';
import type { ApiResponse, Booking, PaginationMetadata } from '@/types';

interface BookingsResponse extends ApiResponse<Booking[]> {
  pagination?: PaginationMetadata;
}

interface CreateBookingPayload {
  type: 'COACH' | 'VENUE';
  targetId: string;
  date: string;
  startTime: string;
  endTime: string;
  sport: string;
  notes?: string;
}

export const bookingApi = {
  getMyBookings: async (status?: string, page = 1): Promise<BookingsResponse> => {
    const res = await apiClient.get('/bookings/my', { params: { status, page } });
    return res.data;
  },

  getBookingById: async (id: string): Promise<ApiResponse<Booking>> => {
    const res = await apiClient.get(`/bookings/${id}`);
    return res.data;
  },

  createBooking: async (data: CreateBookingPayload): Promise<ApiResponse<Booking>> => {
    const res = await apiClient.post('/bookings', data);
    return res.data;
  },

  cancelBooking: async (id: string, reason?: string): Promise<ApiResponse<Booking>> => {
    const res = await apiClient.patch(`/bookings/${id}/cancel`, { reason });
    return res.data;
  },

  getUpcomingBookings: async (): Promise<ApiResponse<Booking[]>> => {
    const res = await apiClient.get('/bookings/upcoming');
    return res.data;
  },
};
