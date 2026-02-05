import { ApiResponse, AuthResponse, User } from "@/types";
import axiosInstance from "./axios";

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "PLAYER" | "VENUE_LISTER" | "COACH";
  }): Promise<AuthResponse> => {
    const response = await axiosInstance.post("/auth/register", data);
    return response.data;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await axiosInstance.post("/auth/login", data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/auth/logout");
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await axiosInstance.get("/auth/profile");
    return response.data;
  },

  forgotPassword: async (
    email: string,
  ): Promise<ApiResponse<{ resetToken: string }>> => {
    const response = await axiosInstance.post("/auth/forgot-password", {
      email,
    });
    return response.data;
  },

  resetPassword: async (
    token: string,
    newPassword: string,
  ): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/auth/reset-password", {
      token,
      newPassword,
    });
    return response.data;
  },

  googleLogin: async (data: {
    googleId: string;
    email: string;
    name: string;
    photoUrl?: string;
    role?: "PLAYER" | "VENUE_LISTER" | "COACH";
  }): Promise<AuthResponse> => {
    const response = await axiosInstance.post("/auth/google", data);
    return response.data;
  },
};
