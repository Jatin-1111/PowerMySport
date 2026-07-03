import axiosInstance from "@/lib/api/axios";
import { ApiResponse } from "@/types";

export type ExpertSessionMode = "ONLINE" | "IN_PERSON";

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
  city?: string;
  languages?: string[];
  photoUrl?: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  createdAt?: string;
}

export type ExpertSessionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export interface ExpertSession {
  id: string;
  _id?: string;
  expertId: string;
  userId: string;
  amount: number;
  status: ExpertSessionStatus;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  scheduledAt?: string;
  mode?: ExpertSessionMode;
  meetingLink?: string;
  clientNote?: string;
  reviewed: boolean;
  rating?: number;
  review?: string;
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

interface Paginated<T> extends ApiResponse<T> {
  pagination?: { total: number; page: number; totalPages: number };
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

  // Initiates PhonePe payment; returns a redirect URL to the hosted checkout.
  initiateSession: async (
    expertId: string,
    payload: { clientNote?: string; mode?: ExpertSessionMode },
  ): Promise<ApiResponse<{ sessionId: string; redirectUrl: string }>> => {
    const res = await axiosInstance.post(
      `/experts/${expertId}/sessions`,
      payload,
    );
    return res.data;
  },

  // Confirms payment status with the gateway after redirect back.
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

  reviewSession: async (
    sessionId: string,
    payload: { rating: number; review?: string },
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
};
