import axiosInstance from "./axios";

export interface ConciergeRequestDoc {
  documentName: string;
  s3Key: string;
}

export interface ConciergeRequestUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ConciergeRequest {
  _id: string;
  userId: ConciergeRequestUser;
  sportSlug: string;
  itemType?: "tournament" | "scholarship" | "university";
  itemId?: string;
  itemName?: string;
  prerequisiteId: string;
  prerequisiteName: string;
  documents: ConciergeRequestDoc[];
  status: "pending" | "processing" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export const conciergeApi = {
  getAllRequests: async () => {
    const res = await axiosInstance.get<{ success: boolean; requests: ConciergeRequest[] }>(
      "/admin/concierge-requests",
    );
    return res.data.requests;
  },

  updateStatus: async (
    id: string,
    status: "pending" | "processing" | "completed" | "rejected",
  ) => {
    const res = await axiosInstance.patch<{ success: boolean; request: ConciergeRequest }>(
      `/admin/concierge-requests/${id}/status`,
      { status },
    );
    return res.data.request;
  },

  getDocumentDownloadUrl: async (requestId: string, s3Key: string) => {
    const res = await axiosInstance.get<{ success: boolean; url: string }>(
      `/admin/concierge-requests/${requestId}/document`,
      {
        params: { key: s3Key },
      },
    );
    return res.data.url;
  },
};
