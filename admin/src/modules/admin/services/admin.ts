import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Coach, CoachVerificationStatus } from "@/types";

export interface Admin {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLogin?: string;
}

const normalizeAdmin = (admin: Partial<Admin> | null | undefined): Admin => {
  const normalizedId = admin?.id || admin?._id || "";

  return {
    id: normalizedId,
    _id: admin?._id,
    name: admin?.name || "",
    email: admin?.email || "",
    role: admin?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    permissions: Array.isArray(admin?.permissions) ? admin.permissions : [],
    isActive: Boolean(admin?.isActive),
    ...(typeof admin?.mustChangePassword === "boolean"
      ? { mustChangePassword: admin.mustChangePassword }
      : {}),
    ...(admin?.lastLogin ? { lastLogin: admin.lastLogin } : {}),
  };
};

export const adminApi = {
  login: async (data: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ admin: Admin; token: string }>> => {
    const response = await axiosInstance.post("/admin/login", data);
    if (response.data?.data?.admin) {
      response.data.data.admin = normalizeAdmin(response.data.data.admin);
    }
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/admin/logout");
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.get("/admin/profile");
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  createAdmin: async (data: {
    name: string;
    email: string;
    role?: "SUPER_ADMIN" | "ADMIN";
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.post("/admin/create", data);
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.post("/admin/change-password", data);
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  getAllAdmins: async (): Promise<ApiResponse<Admin[]>> => {
    const response = await axiosInstance.get("/admin/list");
    if (Array.isArray(response.data?.data)) {
      response.data.data = response.data.data.map((admin: Admin) =>
        normalizeAdmin(admin),
      );
    }
    return response.data;
  },

  getCoachVerifications: async (params?: {
    status?: CoachVerificationStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Coach[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const response = await axiosInstance.get(
      `/admin/coaches/verification?${query.toString()}`,
    );
    return response.data;
  },

  approveCoachVerification: async (
    coachId: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/verify`,
    );
    return response.data;
  },

  rejectCoachVerification: async (
    coachId: string,
    reason: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/reject`,
      { reason },
    );
    return response.data;
  },

  markCoachVerificationForReview: async (
    coachId: string,
    notes?: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/mark-review`,
      { notes },
    );
    return response.data;
  },

  processRefund: async (
    bookingId: string,
    data: {
      refundType: "FULL" | "PARTIAL" | "VENUE_ONLY" | "COACH_ONLY";
      reason: string;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/refunds/${bookingId}`,
      data,
    );
    return response.data;
  },

  handleDispute: async (
    bookingId: string,
    data: {
      disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
      resolution: "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND";
      evidence?: string;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/disputes/${bookingId}`,
      data,
    );
    return response.data;
  },
};
