import axiosInstance from "./axios";
import { ApiResponse } from "@/types";

export interface VenueInquiryData {
  venueName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  sports: string;
  facilities?: string;
  message?: string;
}

export interface VenueInquiry extends VenueInquiryData {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export const venueInquiryApi = {
  submitInquiry: async (data: VenueInquiryData): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.post("/venue-inquiries/submit", data);
    return response.data;
  },

  // Admin endpoints
  getAllInquiries: async (
    status?: string,
  ): Promise<ApiResponse<VenueInquiry[]>> => {
    const params = status ? `?status=${status}` : "";
    const response = await axiosInstance.get(`/venue-inquiries${params}`);
    return response.data;
  },

  getInquiry: async (id: string): Promise<ApiResponse<VenueInquiry>> => {
    const response = await axiosInstance.get(`/venue-inquiries/${id}`);
    return response.data;
  },

  reviewInquiry: async (
    id: string,
    data: { status: "APPROVED" | "REJECTED"; reviewNotes?: string },
  ): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.put(
      `/venue-inquiries/${id}/review`,
      data,
    );
    return response.data;
  },

  deleteInquiry: async (id: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/venue-inquiries/${id}`);
    return response.data;
  },
};
