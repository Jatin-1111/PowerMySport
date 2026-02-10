import axiosInstance from "@/lib/api/axios";
import {
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  OnboardingStep3Payload,
  OnboardingStep5Payload,
  ConfirmImagesPayload,
  PresignedUrl,
  OnboardingVenue,
  PendingVenueListItem,
} from "@/modules/onboarding/types/onboarding";

const API_BASE = "/venues/onboarding";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Venue Onboarding API Service
 * Handles all 4-step onboarding process and admin operations
 *
 * REFACTORED FLOW:
 * Step 1: Venue Lister Contact Info (ownerName, ownerEmail, ownerPhone)
 * Step 2: Venue Details (name, location, sports, price, etc.)
 * Step 3: Images (5-20 images with cover photo)
 * Step 4: Documents (ownership, registration, tax, insurance, certificates)
 */
export const onboardingApi = {
  /**
   * STEP 1: Create venue with venue lister contact info
   */
  submitContactInfo: async (
    data: OnboardingStep1Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/step1`, data);
    return response.data;
  },

  /**
   * STEP 2: Update venue with detailed information
   */
  submitVenueDetails: async (
    data: OnboardingStep2Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/step2`, data);
    return response.data;
  },

  /**
   * STEP 3A: Get presigned URLs for image upload
   */
  getImageUploadUrls: async (
    venueId: string,
    imageCount: number,
    coverPhotoIndex: number,
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/step3/upload-urls`, {
      venueId,
      imageCount,
      coverPhotoIndex,
    });
    return response.data;
  },

  /**
   * STEP 3B: Confirm images after upload
   */
  confirmImagesStep3: async (
    payload: ConfirmImagesPayload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/step3/confirm`,
      payload,
    );
    return response.data;
  },

  /**
   * STEP 4A: Get presigned URLs for document upload
   */
  getDocumentUploadUrls: async (
    venueId: string,
    documents: Array<{
      type: string;
      fileName: string;
      contentType: string;
    }>,
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/step4/upload-urls`, {
      venueId,
      documents,
    });
    return response.data;
  },

  /**
   * STEP 4B: Finalize onboarding with documents
   */
  finalizeOnboarding: async (
    payload: OnboardingStep3Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/step4/finalize`,
      payload,
    );
    return response.data;
  },

  /**
   * STEP 5: Submit in-house coaches (optional)
   */
  submitCoaches: async (
    payload: OnboardingStep5Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/step5/coaches`,
      payload,
    );
    return response.data;
  },

  // DEPRECATED: Old Step 1 method (kept for compatibility)
  /**
   * @deprecated Use submitContactInfo and submitVenueDetails instead
   */
  createVenue: async (
    data: OnboardingStep1Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/step1`, data);
    return response.data;
  },

  // DEPRECATED: Old Step 2 method (kept for compatibility)
  /**
   * @deprecated Use confirmImagesStep3 instead
   */
  confirmImagesStep2: async (
    payload: OnboardingStep2Payload,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/step3/confirm`,
      payload,
    );
    return response.data;
  },

  /**
   * Cancel incomplete onboarding
   */
  cancelOnboarding: async (venueId: string): Promise<ApiResponse<void>> => {
    const response = await axiosInstance.delete(`${API_BASE}/${venueId}`);
    return response.data;
  },

  /**
   * ADMIN: List pending venues
   */
  getPendingVenues: async (
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<
    ApiResponse<{
      venues: PendingVenueListItem[];
      total: number;
      page: number;
      totalPages: number;
    }>
  > => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (status) params.append("status", status);

    const response = await axiosInstance.get(
      `${API_BASE}/admin/pending?${params}`,
    );
    return response.data;
  },

  /**
   * ADMIN: Get venue details for review
   */
  getVenueDetailsForReview: async (
    venueId: string,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.get(`${API_BASE}/admin/${venueId}`);
    return response.data;
  },

  /**
   * ADMIN: Approve venue
   */
  approveVenue: async (
    venueId: string,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/admin/${venueId}/approve`,
    );
    return response.data;
  },

  /**
   * ADMIN: Reject venue
   */
  rejectVenue: async (
    venueId: string,
    reason: string,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/admin/${venueId}/reject`,
      {
        reason,
      },
    );
    return response.data;
  },

  /**
   * ADMIN: Mark venue for review
   */
  markVenueForReview: async (
    venueId: string,
    notes?: string,
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/admin/${venueId}/mark-review`,
      {
        notes,
      },
    );
    return response.data;
  },
};

/**
 * Helper: Upload file to presigned URL
 */
export const uploadFileToPresignedUrl = async (
  file: File,
  presignedUrl: string,
  contentType: string,
): Promise<void> => {
  await axiosInstance.put(presignedUrl, file, {
    headers: {
      "Content-Type": contentType,
    },
  });
};

