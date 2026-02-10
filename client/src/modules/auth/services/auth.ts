import { ApiResponse, AuthResponse, User } from "@/types";
import axiosInstance from "@/lib/api/axios";

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "PLAYER" | "VENUE_LISTER" | "COACH";
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
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

  updateProfile: async (data: {
    name?: string;
    email?: string;
    phone?: string;
    dob?: string | Date;
  }): Promise<ApiResponse<User>> => {
    const response = await axiosInstance.put("/auth/profile", data);
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

  graduateDependent: async (data: {
    dependentId: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<ApiResponse<{ graduatedUserId: string }>> => {
    const response = await axiosInstance.post("/auth/graduate", {
      dependentId: data.dependentId,
      email: data.email,
      password: data.password,
      phone: data.phone,
    });
    return response.data;
  },

  addDependent: async (data: {
    name: string;
    dob: string | Date;
    gender?: "MALE" | "FEMALE" | "OTHER";
    relation?: string;
    sports?: string[];
  }): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.post("/auth/dependents", data);
    return response.data;
  },

  updateDependent: async (
    dependentId: string,
    data: {
      name?: string;
      dob?: string | Date;
      gender?: "MALE" | "FEMALE" | "OTHER";
      relation?: string;
      sports?: string[];
    },
  ): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.put(
      `/auth/dependents/${dependentId}`,
      data,
    );
    return response.data;
  },

  deleteDependent: async (dependentId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(
      `/auth/dependents/${dependentId}`,
    );
    return response.data;
  },
};
