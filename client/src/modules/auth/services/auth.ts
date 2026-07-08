import axiosInstance from "@/lib/api/axios";
import { ApiResponse, AuthResponse, User } from "@/types";

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "Player" | "VenueLister" | "Coach" | "Academy";
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    acceptedTerms: boolean;
    acceptedPrivacy: boolean;
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
    userType?: string;
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
    role?: "Player" | "VenueLister" | "Coach" | "Academy";
    userType?: string;
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

  addDependent: async (data: {
    name: string;
    dob: string | Date;
    gender?: "MALE" | "FEMALE" | "OTHER";
    relation?: string;
    sportsFocus?: string[];
    yearsPlaying?: number;
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    location?: string;
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
      sportsFocus?: string[];
      yearsPlaying?: number;
      personalityTags?: string[];
      primaryObjective?: "Recreational" | "Fitness" | "Compete";
      weeklyTimeCommitment?: number;
      budgetTier?: "Budget" | "Moderate" | "Premium";
      location?: string;
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

  /**
   * Get presigned URL for profile picture upload
   */
  getProfilePictureUploadUrl: async (
    fileName: string,
    contentType: string,
  ): Promise<
    ApiResponse<{
      uploadUrl: string;
      downloadUrl: string;
      key: string;
    }>
  > => {
    const response = await axiosInstance.post(
      "/auth/profile-picture/upload-url",
      {
        fileName,
        contentType,
      },
    );
    return response.data;
  },

  /**
   * Confirm profile picture upload
   */
  confirmProfilePicture: async (
    photoUrl: string,
    photoS3Key: string,
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
    contentType: string,
  ): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(
        `S3 upload failed: ${response.status} ${response.statusText}`,
      );
    }
  },

  linkGoogleAccount: async (
    credential: string,
  ): Promise<ApiResponse<{ user: User }>> => {
    const response = await axiosInstance.post("/auth/google/link", {
      credential,
    });
    return response.data;
  },
};
