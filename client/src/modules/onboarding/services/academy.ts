import axiosInstance from "@/lib/api/axios";
import {
  AcademyListResponse,
  AcademyStep1Payload,
  AcademyStep2Payload,
  AcademyStep3Payload,
  AcademyStep4Payload,
  AcademyStep5Payload,
  AcademyStep6Payload,
  AcademyStepPayload,
  ApiResponse,
  ConfirmDocumentsPayload,
  ConfirmImagesPayload,
  OnboardingAcademy,
  OnboardingProgress,
  PresignedUrl,
} from "@/modules/onboarding/types/academy";

const API_BASE = "/academies/onboarding";

// The academy onboarding API has no session to lean on (academies sign up
// before they have an account), so `start` returns a one-time token and every
// later call for that academy must send it back. It lives next to the
// in-progress academyId, in localStorage, and is never put in a URL.
const TOKEN_KEY_PREFIX = "academy_onboarding_token:";
const TOKEN_HEADER = "X-Academy-Onboarding-Token";

const rememberOnboardingToken = (academyId: string, token: string) => {
  try {
    localStorage.setItem(`${TOKEN_KEY_PREFIX}${academyId}`, token);
  } catch {
    // localStorage not available; the owner/admin session can still resume
  }
};

/** Request config carrying the stored token for this academy, if there is one. */
const withToken = (academyId: string) => {
  try {
    const token = localStorage.getItem(`${TOKEN_KEY_PREFIX}${academyId}`);
    return token ? { headers: { [TOKEN_HEADER]: token } } : {};
  } catch {
    return {};
  }
};

/**
 * Academy Onboarding API Service
 * Handles 6-step onboarding process
 */
export const academyOnboardingApi = {
  /**
   * STEP 1: Start academy onboarding with basic info
   */
  startOnboarding: async (data: AcademyStep1Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(`${API_BASE}/start`, data);
    const body = response.data;
    const started = body?.data as
      { academyId?: string; id?: string; _id?: string; onboardingToken?: string } | undefined;
    const startedId = started?.academyId || started?.id || started?._id;
    if (startedId && started?.onboardingToken) {
      rememberOnboardingToken(String(startedId), started.onboardingToken);
      // Not needed in component state.
      delete started.onboardingToken;
    }
    return body;
  },

  /**
   * Get academy onboarding progress
   */
  getProgress: async (academyId: string): Promise<ApiResponse<OnboardingProgress>> => {
    const response = await axiosInstance.get(
      `${API_BASE}/${academyId}/progress`,
      withToken(academyId)
    );
    return response.data;
  },

  /**
   * Save any step (2-6)
   */
  saveStep: async (
    academyId: string,
    stepNumber: number,
    data: AcademyStepPayload
  ): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${academyId}/step/${stepNumber}`,
      data,
      withToken(academyId)
    );
    return response.data;
  },

  /**
   * STEP 2: Update location and contact details
   */
  submitStep2: async (data: AcademyStep2Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${data.academyId}/step/2`,
      data,
      withToken(data.academyId)
    );
    return response.data;
  },

  /**
   * STEP 3: Get presigned URLs for images
   */
  getImageUploadUrls: async (
    academyId: string,
    imageTypes: ("logo" | "coverPhoto" | "galleryPhotos")[]
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${academyId}/image-upload-urls`,
      { imageTypes },
      withToken(academyId)
    );
    return response.data;
  },

  /**
   * STEP 3: Confirm images uploaded
   */
  confirmImages: async (payload: ConfirmImagesPayload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${payload.academyId}/confirm-images`,
      payload,
      withToken(payload.academyId)
    );
    return response.data;
  },

  /**
   * STEP 3: Get presigned URLs for documents
   */
  getDocumentUploadUrls: async (
    academyId: string,
    docTypes: ("panDocument" | "gstDocument")[]
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${academyId}/document-upload-urls`,
      { docTypes },
      withToken(academyId)
    );
    return response.data;
  },

  /**
   * STEP 3: Confirm documents uploaded
   */
  confirmDocuments: async (
    payload: ConfirmDocumentsPayload
  ): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${payload.academyId}/confirm-documents`,
      payload,
      withToken(payload.academyId)
    );
    return response.data;
  },

  /**
   * STEP 3: Update legal details and save documents
   */
  submitStep3: async (data: AcademyStep3Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${data.academyId}/step/3`,
      data,
      withToken(data.academyId)
    );
    return response.data;
  },

  /**
   * STEP 4: Link venues and coaches
   */
  submitStep4: async (data: AcademyStep4Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${data.academyId}/step/4`,
      data,
      withToken(data.academyId)
    );
    return response.data;
  },

  /**
   * STEP 5: Set pricing and subscription plans
   */
  submitStep5: async (data: AcademyStep5Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${data.academyId}/step/5`,
      data,
      withToken(data.academyId)
    );
    return response.data;
  },

  /**
   * STEP 6: Set payout details and submit for approval
   */
  submitStep6: async (data: AcademyStep6Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(
      `${API_BASE}/${data.academyId}/step/6`,
      data,
      withToken(data.academyId)
    );
    return response.data;
  },

  /**
   * Submit academy for admin approval
   */
  submitForApproval: async (academyId: string): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${academyId}/submit`,
      undefined,
      withToken(academyId)
    );
    return response.data;
  },

  /**
   * List approved academies (public)
   */
  listApprovedAcademies: async (
    page: number = 1,
    limit: number = 20,
    filters?: {
      city?: string;
      sport?: string;
      ageGroup?: string;
      minPrice?: number;
      maxPrice?: number;
      verifiedOnly?: boolean;
    }
  ): Promise<ApiResponse<AcademyListResponse>> => {
    const response = await axiosInstance.get(`${API_BASE.replace("/onboarding", "")}`, {
      params: {
        page,
        limit,
        ...filters,
      },
    });
    return response.data;
  },

  /**
   * Get single academy profile by slug
   */
  getAcademyProfile: async (slug: string): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.get(`${API_BASE.replace("/onboarding", "")}/${slug}`);
    return response.data;
  },
};
