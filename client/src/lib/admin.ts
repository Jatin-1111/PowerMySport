import axiosInstance from "./axios";
import { ApiResponse } from "@/types";

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
};
