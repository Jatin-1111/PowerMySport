import axiosInstance from "@/lib/api/axios";
import {
  ConfirmImagesPayload,
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  OnboardingStep3Payload,
  OnboardingStep5Payload,
  OnboardingVenue,
  PresignedUrl,
} from "@/modules/onboarding/types/onboarding";
import axios from "axios";

const API_BASE = "/venues/onboarding";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Venue Onboarding API Service
 * Handles all 4-step onboarding process
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
   * Now generates URLs for 3 general images + 5 per sport
   */
  getImageUploadUrls: async (
    venueId: string,
    sports: string[],
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/step3/upload-urls`, {
      venueId,
      sports,
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

  /**
   * Get coach photo upload URL
   */
  getCoachPhotoUploadUrl: async (
    venueId: string,
    fileName: string,
    contentType: string,
  ): Promise<
    ApiResponse<{ uploadUrl: string; downloadUrl: string; s3Key: string }>
  > => {
    const response = await axiosInstance.post(
      `${API_BASE}/coach-photo-upload-url`,
      {
        venueId,
        fileName,
        contentType,
      },
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
};

/**
 * Helper: Upload file to presigned URL
 */
export const uploadFileToPresignedUrl = async (
  file: File,
  presignedUrl: string,
  contentType: string,
): Promise<void> => {
  await axios.put(presignedUrl, file, {
    headers: {
      "Content-Type": contentType,
    },
    withCredentials: false,
  });
};
