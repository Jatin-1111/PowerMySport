import axiosInstance from "@/lib/api/axios";
import { ApiResponse, PaginationMetadata } from "@/types";

export type ExpertSessionMode = "ONLINE" | "IN_PERSON";

export interface ExpertAvailabilityWindow {
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface Expert {
  id: string;
  _id?: string;
  name?: string;
  email?: string;
  bio: string;
  sports: string[];
  expertise: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  sessionDurationMinutes?: number;
  timezone?: string;
  hasAvailability?: boolean;
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  createdAt?: string;
  // Owner/admin-only (via /experts/me or admin endpoints)
  weeklyAvailability?: ExpertAvailabilityWindow[];
  blackoutDates?: string[];
}

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

export type ExpertSessionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export type ExpertRefundStatus = "NONE" | "REQUIRED" | "MANUAL_DONE";

export interface ExpertSession {
  id: string;
  _id?: string;
  expertId: string;
  userId: string;
  amount: number;
  status: ExpertSessionStatus;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  scheduledAt?: string;
  durationMinutes?: number;
  mode?: ExpertSessionMode;
  meetingLink?: string;
  clientNote?: string;
  cancelledAt?: string;
  cancelledBy?: "CLIENT" | "EXPERT" | "ADMIN" | "SYSTEM";
  cancelReason?: string;
  refundStatus?: ExpertRefundStatus;
  reviewed: boolean;
  rating?: number;
  review?: string;
  reviewAnonymous?: boolean;
  reviewedAt?: string;
  expert?: Expert;
  clientName?: string;
  createdAt: string;
}

export interface ExpertReview {
  rating: number;
  review?: string;
  reviewerName?: string;
  reviewedAt?: string;
}

interface Paginated<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PaginationMetadata;
}

export const expertApi = {
  listExperts: async (params?: {
    sport?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Expert[]>> => {
    const q = new URLSearchParams();
    if (params?.sport) q.append("sport", params.sport);
    if (params?.search) q.append("search", params.search);
    if (params?.page) q.append("page", String(params.page));
    if (params?.limit) q.append("limit", String(params.limit));
    const res = await axiosInstance.get(`/experts?${q.toString()}`);
    return res.data;
  },

  getExpert: async (expertId: string): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.get(`/experts/${expertId}`);
    return res.data;
  },

  getExpertReviews: async (
    expertId: string,
  ): Promise<ApiResponse<ExpertReview[]>> => {
    const res = await axiosInstance.get(`/experts/${expertId}/reviews`);
    return res.data;
  },

  // Open bookable slots for an expert over an optional date range.
  getAvailability: async (
    expertId: string,
    params?: { from?: string; to?: string },
  ): Promise<ApiResponse<OpenSlot[]>> => {
    const q = new URLSearchParams();
    if (params?.from) q.append("from", params.from);
    if (params?.to) q.append("to", params.to);
    const res = await axiosInstance.get(
      `/experts/${expertId}/availability?${q.toString()}`,
    );
    return res.data;
  },

  // Initiates PhonePe payment for a chosen slot; returns a hosted-checkout URL.
  initiateSession: async (
    expertId: string,
    payload: { scheduledAt: string; clientNote?: string; mode?: ExpertSessionMode },
  ): Promise<ApiResponse<{ sessionId: string; redirectUrl: string }>> => {
    const res = await axiosInstance.post(
      `/experts/${expertId}/sessions`,
      payload,
    );
    return res.data;
  },

  reconcileSession: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/reconcile`,
    );
    return res.data;
  },

  getSession: async (sessionId: string): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.get(`/experts/sessions/${sessionId}`);
    return res.data;
  },

  scheduleSession: async (
    sessionId: string,
    payload: { scheduledAt: string; mode?: ExpertSessionMode },
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.patch(
      `/experts/sessions/${sessionId}/schedule`,
      payload,
    );
    return res.data;
  },

  setMeetingLink: async (
    sessionId: string,
    meetingLink: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.patch(
      `/experts/sessions/${sessionId}/meeting-link`,
      { meetingLink },
    );
    return res.data;
  },

  completeSession: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/complete`,
    );
    return res.data;
  },

  cancelSession: async (
    sessionId: string,
    reason?: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/cancel`,
      { reason },
    );
    return res.data;
  },

  reviewSession: async (
    sessionId: string,
    payload: { rating: number; review?: string; anonymous?: boolean },
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/review`,
      payload,
    );
    return res.data;
  },

  mySessions: async (): Promise<ApiResponse<ExpertSession[]>> => {
    const res = await axiosInstance.get(`/experts/sessions/mine`);
    return res.data;
  },

  // For the logged-in expert's dashboard.
  expertSessions: async (): Promise<ApiResponse<ExpertSession[]>> => {
    const res = await axiosInstance.get(`/experts/sessions/expert`);
    return res.data;
  },

  // Expert self-service profile (role EXPERT).
  getMyProfile: async (): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.get(`/experts/me`);
    return res.data;
  },

  updateMyProfile: async (
    patch: Partial<
      Pick<
        Expert,
        | "bio"
        | "achievements"
        | "sports"
        | "expertise"
        | "languages"
        | "city"
        | "sessionMode"
        | "sessionFee"
        | "sessionDurationMinutes"
        | "timezone"
        | "photoUrl"
        | "photoKey"
        | "weeklyAvailability"
        | "blackoutDates"
      >
    >,
  ): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.patch(`/experts/me`, patch);
    return res.data;
  },
};
