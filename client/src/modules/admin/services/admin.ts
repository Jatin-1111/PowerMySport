import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Coach, CoachVerificationStatus } from "@/types";

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  permissions: string[];
  isActive: boolean;
  lastLogin?: string;
}

export const adminApi = {
  login: async (data: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ admin: Admin; token: string }>> => {
    const response = await axiosInstance.post("/admin/login", data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/admin/logout");
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.get("/admin/profile");
    return response.data;
  },

  createAdmin: async (data: {
    name: string;
    email: string;
    password: string;
    role?: "SUPER_ADMIN" | "ADMIN";
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.post("/admin/create", data);
    return response.data;
  },

  getAllAdmins: async (): Promise<ApiResponse<Admin[]>> => {
    const response = await axiosInstance.get("/admin/list");
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
};
