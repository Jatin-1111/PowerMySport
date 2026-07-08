import axiosInstance from "@/lib/api/axios";
import { clearRequestCache, withRequestCache } from "@/lib/api/requestCache";
import {
    ApiResponse,
    Availability,
    Booking,
    InitiateBookingResponse,
} from "@/types";

const INVITATIONS_TTL_MS = 5000;

export const bookingApi = {
  // Initiate booking with split payments
  initiateBooking: async (data: {
    venueId?: string;
    coachId?: string;
    academyId?: string;
    playerLocation?: {
      type: "Point";
      coordinates: [number, number];
    };
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
    dependentId?: string;
    promoCode?: string;
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

  getVenueAvailabilityWithAlternates: async (
    venueId: string,
    date: string,
    preferredStartTime: string,
    preferredEndTime: string,
  ): Promise<ApiResponse<Availability & { alternateSlots?: string[] }>> => {
    const response = await axiosInstance.get(
      `/bookings/availability/${venueId}`,
      {
        params: { date, preferredStartTime, preferredEndTime },
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
  cancelBooking: async (
    bookingId: string,
    cancellationReason?: string,
  ): Promise<ApiResponse<{ refundAmount: number; refundPercentage: number }>> => {
    const response = await axiosInstance.delete(`/bookings/${bookingId}`, {
      data: cancellationReason ? { cancellationReason } : undefined,
    });
    return response.data;
  },

  retryRefund: async (
    bookingId: string,
  ): Promise<ApiResponse<{ refundStatus: string; refundAmount: number }>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/retry-refund`,
    );
    return response.data;
  },

  confirmBookingByProvider: async (
    bookingId: string,
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/provider/confirm`,
    );
    return response.data;
  },

  rejectBookingByProvider: async (
    bookingId: string,
    reason?: string,
  ): Promise<ApiResponse<{ booking: Booking; refundAmount?: number }>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/provider/reject`,
      reason ? { reason } : undefined,
    );
    return response.data;
  },

  // Confirm mock payment success and trigger confirmation side effects
  confirmMockPaymentSuccess: async (
    bookingId: string,
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/mock-payment-success`,
    );
    return response.data;
  },

  // Initiate PhonePe payment for booking
  initiatePhonePePayment: async (
    bookingId: string,
    payload?: { type?: "coach" | "venue" },
  ): Promise<{
    redirectUrl: string;
    merchantOrderId: string;
    state?: string;
  }> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/phonepe/initiate`,
      payload || {},
    );
    return response.data.data;
  },

  // Pay for booking using wallet balance
  payWithWallet: async (bookingId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/wallet/pay`,
    );
    return response.data;
  },

  // Verify PhonePe order status (fallback)
  verifyPhonePeOrderStatus: async (
    merchantOrderId: string,
  ): Promise<{ state?: string; merchantOrderId: string }> => {
    const response = await axiosInstance.get(
      `/bookings/phonepe/status/${merchantOrderId}`,
    );
    return response.data.data;
  },

  // Check-in booking using player-provided random code
  checkInBookingByCode: async (
    checkInCode: string,
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post("/bookings/check-in/code", {
      checkInCode,
    });
    return response.data;
  },

  // Get single booking by ID
  getBooking: async (bookingId: string): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.get(`/bookings/${bookingId}`);
    return response.data;
  },

  downloadInvoicePdf: async (bookingId: string): Promise<Blob> => {
    const response = await axiosInstance.get(
      `/bookings/${bookingId}/invoice/pdf`,
      { responseType: "blob" },
    );
    return response.data as Blob;
  },

  validatePromoCode: async (payload: {
    code: string;
    subtotal: number;
    hasCoach?: boolean;
  }): Promise<{
    isValid: boolean;
    discountAmount: number;
    message?: string;
  }> => {
    const response = await axiosInstance.post(
      "/bookings/promo/validate",
      payload,
    );
    return response.data.data;
  },

  joinWaitlist: async (payload: {
    venueId?: string;
    coachId?: string;
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
    alternateSlots?: string[];
  }): Promise<ApiResponse<{ id: string; status: string }>> => {
    const response = await axiosInstance.post("/bookings/waitlist", payload);
    return response.data;
  },

  // ============================================
  // GROUP BOOKING METHODS
  // ============================================

  // Initiate group booking with friends
  initiateGroupBooking: async (data: {
    venueId?: string;
    coachId?: string;
    playerLocation?: {
      type: "Point";
      coordinates: [number, number];
    };
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
    invitedFriendIds: string[];
    paymentType: "SINGLE" | "SPLIT";
    promoCode?: string;
  }): Promise<InitiateBookingResponse> => {
    const response = await axiosInstance.post("/bookings/initiate-group", data);
    return response.data.data;
  },

  // Get booking invitations
  getMyInvitations: async (
    status?: "PENDING" | "ACCEPTED" | "DECLINED",
  ): Promise<any[]> => {
    const cacheKey = `bookings:invitations:${status || "ALL"}`;
    return withRequestCache(
      cacheKey,
      async () => {
        const params = status ? { status } : {};
        const response = await axiosInstance.get("/bookings/invitations", {
          params,
        });
        return response.data.data;
      },
      INVITATIONS_TTL_MS,
    );
  },

  // Respond to booking invitation
  respondToInvitation: async (
    invitationId: string,
    accept: boolean,
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post(
      `/bookings/invitations/${invitationId}/respond`,
      { accept },
    );
    clearRequestCache([
      "bookings:pending-invitations-count",
      "bookings:invitations:",
    ]);
    return response.data;
  },

  // Organizer covers unpaid shares
  coverUnpaidShares: async (
    bookingId: string,
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/cover-payments`,
    );
    return response.data;
  },

  // Get count of pending booking invitations
  getPendingInvitationsCount: async (): Promise<{ count: number }> => {
    return withRequestCache(
      "bookings:pending-invitations-count",
      async () => {
        const response = await axiosInstance.get(
          "/bookings/invitations/pending-count",
        );
        return response.data.data;
      },
      INVITATIONS_TTL_MS,
    );
  },

  // Reschedule a confirmed booking (coach only)
  rescheduleBooking: async (
    bookingId: string,
    payload: {
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    },
  ): Promise<ApiResponse<Booking>> => {
    const response = await axiosInstance.post(
      `/bookings/${bookingId}/reschedule`,
      payload,
    );
    return response.data;
  },
};
