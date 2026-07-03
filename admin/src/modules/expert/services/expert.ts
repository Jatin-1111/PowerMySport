import axiosInstance from "@/lib/api/axios";
import { ApiResponse, PaginationMetadata } from "@/types";

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
  city?: string;
  languages?: string[];
  photoUrl?: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  createdAt?: string;
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
  city?: string;
  languages?: string[];
  photoUrl?: string;
}

interface Paginated<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PaginationMetadata;
}

export const expertAdminApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<Paginated<AdminExpert[]>> => {
    const q = new URLSearchParams();
    if (params?.page) q.append("page", String(params.page));
    if (params?.limit) q.append("limit", String(params.limit));
    const res = await axiosInstance.get(`/experts/admin/all?${q.toString()}`);
    return res.data;
  },

  create: async (
    payload: CreateExpertPayload,
  ): Promise<ApiResponse<AdminExpert>> => {
    const res = await axiosInstance.post(`/experts/admin`, payload);
    return res.data;
  },
};
