import axiosInstance from "@/lib/api/axios";
import { ApiResponse, AuthResponse, Dependent, User } from "@/types";
import { requestParentalConsent } from "@/modules/player/store/parentalConsentStore";
import { useAuthStore } from "../store/authStore";

const CONSENT_REQUIRED = 428;

/** Remembers that the parent has agreed, so the next save does not ask again. */
const markConsentGiven = () => {
  // setState, not setUser: the stored user already has normalized dependents,
  // and setUser would normalize them a second time.
  const { user } = useAuthStore.getState();
  if (user) useAuthStore.setState({ user: { ...user, parentalConsentCurrent: true } });
};

/** Asks for the parent's agreement, then adds the child with it. */
const askThenAddDependent = async (payload: Record<string, unknown>) => {
  if (!(await requestParentalConsent())) {
    throw new Error("We need your agreement to the Parental Consent policy to add a child.");
  }
  const response = await axiosInstance.post("/auth/dependents", {
    ...payload,
    parentalConsent: true,
  });
  markConsentGiven();
  return response.data;
};

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "Parent" | "Player" | "VenueLister" | "Coach" | "Academy" | "EXPERT";
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    acceptedTerms: boolean;
    acceptedPrivacy: boolean;
  }): Promise<AuthResponse> => {
    const response = await axiosInstance.post("/auth/register", data);
    return response.data;
  },

  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
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
    parentProfile?: {
      bio?: string;
      sportInterests?: string[];
      involvementYears?: number;
    };
    playerProfile?: {
      sportsFocus?: string[];
      yearsPlaying?: number;
      personalityTags?: string[];
      primaryObjective?: "Recreational" | "Fitness" | "Compete";
      weeklyTimeCommitment?: number;
      budgetTier?: "Budget" | "Moderate" | "Premium";
      location?: string;
    };
    shippingAddress?: User["shippingAddress"];
  }): Promise<ApiResponse<User>> => {
    const response = await axiosInstance.put("/auth/profile", data);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse<{ resetToken: string }>> => {
    const response = await axiosInstance.post("/auth/forgot-password", {
      email,
    });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/auth/reset-password", {
      token,
      newPassword,
    });
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.put("/auth/change-password", data);
    return response.data;
  },

  deleteAccount: async (password: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/auth/delete-account", {
      password,
    });
    return response.data;
  },

  googleLogin: async (data: {
    // Raw Google ID token ("credential" from Google Identity Services).
    // The server verifies this and derives identity from it — we no longer
    // send client-decoded googleId/email (those were forgeable).
    credential: string;
    role?: "Parent" | "Player" | "VenueLister" | "Coach" | "Academy" | "EXPERT";
    action?: "login" | "register";
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
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

  /** A child goes to the server exactly as the `Dependent` type describes it. */
  addDependent: async (
    data: Partial<Omit<Dependent, "_id">> & { name: string }
  ): Promise<ApiResponse<any>> => {
    const payload: Record<string, unknown> = { ...data };

    // The profile already says consent is missing, so ask first instead of sending a
    // request that is certain to be refused.
    if (useAuthStore.getState().user?.parentalConsentCurrent === false) {
      return askThenAddDependent(payload);
    }

    try {
      const response = await axiosInstance.post("/auth/dependents", payload);
      return response.data;
    } catch (error) {
      // The consent state was not known here (a fresh sign-in has not loaded the
      // profile yet), and the server asks before it takes a child's details.
      if ((error as { response?: { status?: number } }).response?.status !== CONSENT_REQUIRED) {
        throw error;
      }
      return askThenAddDependent(payload);
    }
  },

  updateDependent: async (
    dependentId: string,
    data: Partial<Omit<Dependent, "_id">>
  ): Promise<ApiResponse<any>> => {
    // A parent who has not agreed to the current policy is asked at their next
    // edit. Declining does not block the edit; only adding a child needs it.
    const needsConsent = useAuthStore.getState().user?.parentalConsentCurrent === false;
    const agreed = needsConsent ? await requestParentalConsent() : false;
    const response = await axiosInstance.put(`/auth/dependents/${dependentId}`, {
      ...data,
      ...(agreed ? { parentalConsent: true } : {}),
    });
    if (agreed) markConsentGiven();
    return response.data;
  },

  deleteDependent: async (dependentId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.delete(`/auth/dependents/${dependentId}`);
    return response.data;
  },

  getPlayers: async (): Promise<ApiResponse<any[]>> => {
    const response = await axiosInstance.get("/auth/players");
    return response.data;
  },

  /**
   * Get presigned URL for profile picture upload
   */
  getProfilePictureUploadUrl: async (
    fileName: string,
    contentType: string
  ): Promise<
    ApiResponse<{
      uploadUrl: string;
      downloadUrl: string;
      key: string;
    }>
  > => {
    const response = await axiosInstance.post("/auth/profile-picture/upload-url", {
      fileName,
      contentType,
    });
    return response.data;
  },

  /**
   * Confirm profile picture upload
   */
  confirmProfilePicture: async (
    photoUrl: string,
    photoS3Key: string
  ): Promise<ApiResponse<User>> => {
    const response = await axiosInstance.post("/auth/profile-picture/confirm", {
      photoUrl,
      photoS3Key,
    });
    return response.data;
  },

  /**
   * Upload profile picture to presigned URL
   * Uses raw fetch (not axios) to avoid extra headers that break presigned URL signature
   */
  uploadProfilePictureToS3: async (
    file: File,
    uploadUrl: string,
    contentType: string
  ): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
    }
  },

  linkGoogleAccount: async (credential: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await axiosInstance.post("/auth/google/link", {
      credential,
    });
    return response.data;
  },
};
