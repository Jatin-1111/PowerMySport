import axiosInstance from "@/lib/api/axios";
import {
    AnalyticsData,
    ApiResponse,
    ClientDetails,
    ClientNote,
    ClientSummary,
    Coach,
    CoachCalendarData,
    CoachSubscription,
    CoachSubscriptionPackage,
    CoachSubscriptionPackageCreateInput,
    CoachVerificationDocument,
    EarningsData,
    IAvailability,
    IBlockedDate,
    NoteType,
} from "@/types";

export interface CoachVerificationUploadResponse {
  uploadUrl: string;
  downloadUrl: string;
  fileName: string;
  key: string;
}

export const coachApi = {
  // Save verification step 1 (bio)
  saveVerificationStep1: async (payload: {
    bio: string;
    mobileNumber: string;
  }): Promise<ApiResponse<Coach | { bio: string; mobileNumber: string }>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step1",
      payload,
    );
    return response.data;
  },

  // Save verification step 2 (sports/profile)
  saveVerificationStep2: async (payload: {
    bio: string;
    sports: string[];
    certifications?: string[];
    hourlyRate: number;
    sportPricing?: Record<string, number>;
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    baseLocation?: {
      type: "Point";
      coordinates: [number, number];
    };
    serviceRadiusKm?: number;
    travelBufferTime?: number;
    ownVenueDetails?: {
      name: string;
      address: string;
      description?: string;
      openingHours?: string;
      images?: string[];
      imageS3Keys?: string[];
      coordinates?: [number, number];
      location?: {
        type: "Point";
        coordinates: [number, number];
      };
    };
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step2",
      payload,
    );
    return response.data;
  },

  // Submit verification step 3 (documents)
  submitVerificationStep3: async (payload: {
    documents?: CoachVerificationDocument[];
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/step3",
      payload,
    );
    return response.data;
  },

  // Get current user's coach profile
  getMyProfile: async (): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.get("/coaches/my-profile");
    return response.data;
  },

  // Get coach by ID
  getCoachById: async (coachId: string): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.get(`/coaches/${coachId}`);
    return response.data;
  },

  // Update coach profile
  updateProfile: async (
    coachId: string,
    data: Partial<Coach>,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.put(`/coaches/${coachId}`, data);
    return response.data;
  },

  // Update current coach availability by sport
  updateMyAvailability: async (data: {
    availabilityBySport: Record<string, IAvailability[]>;
  }): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.put(
      "/coaches/my-profile/availability",
      data,
    );
    return response.data;
  },

  // Get presigned upload URL for verification documents
  getVerificationUploadUrl: async (payload: {
    fileName: string;
    contentType: string;
    documentType: CoachVerificationDocument["type"];
    purpose?: "DOCUMENT" | "VENUE_IMAGE";
  }): Promise<ApiResponse<CoachVerificationUploadResponse>> => {
    const response = await axiosInstance.post(
      "/coaches/verification/upload-url",
      payload,
    );
    return response.data;
  },

  // Coach-owned subscription packages
  listMyPackages: async (): Promise<
    ApiResponse<{ packages: CoachSubscriptionPackage[] }>
  > => {
    const response = await axiosInstance.get("/coaches/subscription-packages");
    return response.data;
  },

  createPackage: async (
    payload: CoachSubscriptionPackageCreateInput,
  ): Promise<ApiResponse<{ package: CoachSubscriptionPackage }>> => {
    const response = await axiosInstance.post(
      "/coaches/subscription-packages",
      payload,
    );
    return response.data;
  },

  updatePackage: async (
    packageId: string,
    payload: Partial<CoachSubscriptionPackageCreateInput>,
  ): Promise<ApiResponse<{ package: CoachSubscriptionPackage }>> => {
    const response = await axiosInstance.put(
      `/coaches/subscription-packages/${packageId}`,
      payload,
    );
    return response.data;
  },

  deletePackage: async (packageId: string): Promise<ApiResponse<{}>> => {
    const response = await axiosInstance.delete(
      `/coaches/subscription-packages/${packageId}`,
    );
    return response.data;
  },

  getActiveSubscriptionsForCoach: async (): Promise<
    ApiResponse<{ subscriptions: any[] }>
  > => {
    const response = await axiosInstance.get(
      "/coaches/subscription-packages/active-subscriptions",
    );
    return response.data;
  },

  getCoachActiveSubscriptions: async (): Promise<
    ApiResponse<{ subscriptions: any[] }>
  > => {
    const response = await axiosInstance.get(
      "/coaches/subscription-packages/active-subscriptions",
    );
    return response.data;
  },

  getSubscriptionRevenue: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ revenue: any }>> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    const response = await axiosInstance.get(
      `/coaches/subscription-packages/revenue${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return response.data;
  },

  // Public: get a coach's packages
  getCoachPackages: async (
    coachId: string,
  ): Promise<ApiResponse<{ packages: CoachSubscriptionPackage[] }>> => {
    const response = await axiosInstance.get(
      `/coaches/${coachId}/subscription-packages`,
    );
    return response.data;
  },

  // New: subscribe to a package
  subscribeToPackage: async (payload: {
    coachId: string;
    packageId: string;
    merchantOrderId: string;
  }): Promise<ApiResponse<{ subscription: any }>> => {
    const response = await axiosInstance.post(
      "/coaches/subscriptions",
      payload,
    );
    return response.data;
  },

  cancelCoachSubscription: async (
    subscriptionId: string,
    reason?: string,
  ): Promise<ApiResponse<{ subscription: CoachSubscription }>> => {
    const response = await axiosInstance.delete(
      `/coaches/subscriptions/${subscriptionId}`,
      {
        data: {
          subscriptionId,
          reason,
        },
      },
    );
    return response.data;
  },

  getMySubscriptions: async (params?: {
    coachId?: string;
  }): Promise<ApiResponse<{ subscriptions: CoachSubscription[] }>> => {
    const query = new URLSearchParams();
    if (params?.coachId) {
      query.append("coachId", params.coachId);
    }

    const response = await axiosInstance.get(
      `/coaches/subscriptions${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return response.data;
  },

  initiateSubscriptionPayment: async (payload: {
    coachId: string;
    packageId: string;
    dependentId?: string;
  }): Promise<{
    redirectUrl: string;
    merchantOrderId: string;
    state?: string;
    amountBreakdown?: {
      baseAmount: number;
      platformFee: number;
      taxAmount: number;
      total: number;
    };
  }> => {
    const response = await axiosInstance.post(
      "/coaches/subscriptions/phonepe/initiate",
      payload,
    );
    return response.data.data;
  },

  verifySubscriptionPaymentStatus: async (
    merchantOrderId: string,
  ): Promise<{
    state?: string;
    merchantOrderId: string;
    subscriptionId?: string | null;
    amountBreakdown?: {
      baseAmount: number;
      platformFee: number;
      taxAmount: number;
      total: number;
    };
  }> => {
    const response = await axiosInstance.get(
      `/coaches/subscriptions/phonepe/status/${merchantOrderId}`,
    );
    return response.data.data;
  },

  // Get coach calendar for a date range
  getCalendar: async (
    startDate: string,
    endDate: string,
  ): Promise<ApiResponse<CoachCalendarData>> => {
    const response = await axiosInstance.get("/coaches/my-profile/calendar", {
      params: { startDate, endDate },
    });
    return response.data;
  },

  // Block a date range
  blockDates: async (payload: {
    startDate: string;
    endDate: string;
    reason?: string;
    allDay?: boolean;
  }): Promise<ApiResponse<IBlockedDate>> => {
    const response = await axiosInstance.post(
      "/coaches/my-profile/block-dates",
      payload,
    );
    return response.data;
  },

  // Remove a blocked date
  unblockDate: async (blockId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(
      `/coaches/my-profile/block-dates/${blockId}`,
    );
    return response.data;
  },

  // CRM — client/athlete management
  getClients: async (): Promise<ApiResponse<ClientSummary[]>> => {
    const response = await axiosInstance.get("/coaches/my-clients");
    return response.data;
  },

  getClientDetails: async (
    clientUserId: string,
  ): Promise<ApiResponse<ClientDetails>> => {
    const response = await axiosInstance.get(
      `/coaches/my-clients/${clientUserId}`,
    );
    return response.data;
  },

  addClientNote: async (
    clientUserId: string,
    payload: {
      note: string;
      noteType?: NoteType;
      sessionDate?: string;
      bookingId?: string;
    },
  ): Promise<ApiResponse<ClientNote>> => {
    const response = await axiosInstance.post(
      `/coaches/my-clients/${clientUserId}/notes`,
      payload,
    );
    return response.data;
  },

  deleteClientNote: async (
    clientUserId: string,
    noteId: string,
  ): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(
      `/coaches/my-clients/${clientUserId}/notes/${noteId}`,
    );
    return response.data;
  },

  // Earnings & Analytics
  getEarnings: async (): Promise<ApiResponse<EarningsData>> => {
    const response = await axiosInstance.get("/coaches/earnings");
    return response.data;
  },

  getAnalytics: async (): Promise<ApiResponse<AnalyticsData>> => {
    const response = await axiosInstance.get("/coaches/analytics");
    return response.data;
  },
};
