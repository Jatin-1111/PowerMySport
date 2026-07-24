import axiosInstance from "@/lib/api/axios";
import { ApiResponse, PaginationMetadata } from "@/types";

export interface AdminExpertAvailabilityWindow {
  dayOfWeek: number;
  start: string;
  end: string;
}

export interface AdminExpertPayoutMethod {
  id?: string;
  type: "BANK_TRANSFER" | "UPI";
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  isDefault?: boolean;
}

export type AdminExpertVerificationStatus = "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";

export interface AdminExpert {
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
  weeklyAvailability?: AdminExpertAvailabilityWindow[];
  blackoutDates?: string[];
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  /** Where an IN_PERSON/BOTH-mode session happens — never shown on the public listing. */
  inPersonAddress?: string;
  isActive: boolean;
  verificationStatus?: AdminExpertVerificationStatus;
  rejectionReason?: string;
  rating: number;
  reviewCount: number;
  createdAt?: string;
  panNumber?: string;
  gstNumber?: string;
  payoutMethods?: AdminExpertPayoutMethod[];
}

export interface CreateExpertPayload {
  name: string;
  email: string;
  phone: string;
  bio?: string;
  sports?: string[];
  expertise?: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode?: "ONLINE" | "IN_PERSON" | "BOTH";
  sessionDurationMinutes?: number;
  weeklyAvailability?: AdminExpertAvailabilityWindow[];
  blackoutDates?: string[];
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  inPersonAddress?: string;
}

export type UpdateExpertPayload = Partial<
  Pick<
    AdminExpert,
    | "bio"
    | "achievements"
    | "sports"
    | "expertise"
    | "languages"
    | "city"
    | "sessionMode"
    | "sessionFee"
    | "sessionDurationMinutes"
    | "weeklyAvailability"
    | "blackoutDates"
    | "photoUrl"
    | "photoKey"
    | "inPersonAddress"
    | "isActive"
  >
>;

export interface AdminExpertSession {
  id: string;
  _id?: string;
  amount: number;
  status: string;
  paymentStatus: string;
  scheduledAt?: string;
  mode?: string;
  clientName?: string;
  refundStatus?: "NONE" | "REQUIRED" | "MANUAL_DONE";
  cancellationNoticeHours?: number;
  payoutStatus?: "PENDING" | "PAID";
  payoutPaidAt?: string;
  reviewed?: boolean;
  rating?: number;
  review?: string;
  reviewHidden?: boolean;
  createdAt: string;
}

export interface AdminExpertSessionsResult {
  sessions: AdminExpertSession[];
  summary: {
    total: number;
    completed: number;
    upcoming: number;
    grossEarnings: number;
    refundsPending: number;
    payoutPending: number;
    payoutReleased: number;
  };
}

interface Paginated<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PaginationMetadata;
  pendingCount?: number;
}

export const expertAdminApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    verificationStatus?: string;
  }): Promise<Paginated<AdminExpert[]>> => {
    const q = new URLSearchParams();
    if (params?.page) q.append("page", String(params.page));
    if (params?.limit) q.append("limit", String(params.limit));
    if (params?.verificationStatus) q.append("verificationStatus", params.verificationStatus);
    const res = await axiosInstance.get(`/experts/admin/all?${q.toString()}`);
    return res.data;
  },

  create: async (
    payload: CreateExpertPayload,
  ): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.post(`/experts/admin`, payload);
    return res.data;
  },

  update: async (
    expertId: string,
    payload: UpdateExpertPayload,
  ): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.patch(
      `/experts/admin/${expertId}`,
      payload,
    );
    return res.data;
  },

  setActive: async (
    expertId: string,
    isActive: boolean,
  ): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.patch(`/experts/admin/${expertId}/active`, {
      isActive,
    });
    return res.data;
  },

  getSessions: async (
    expertId: string,
  ): Promise<ApiResponse<AdminExpertSessionsResult>> => {
    const res = await axiosInstance.get(`/experts/admin/${expertId}/sessions`);
    return res.data;
  },

  markRefundDone: async (
    sessionId: string,
  ): Promise<ApiResponse<AdminExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/refund-done`,
    );
    return res.data;
  },

  hideReview: async (
    sessionId: string,
    hidden: boolean,
  ): Promise<ApiResponse<AdminExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/hide-review`,
      { hidden },
    );
    return res.data;
  },

  approve: async (expertId: string): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.post(`/experts/admin/${expertId}/approve`);
    return res.data;
  },

  reject: async (expertId: string, reason: string): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.post(`/experts/admin/${expertId}/reject`, { reason });
    return res.data;
  },
};
