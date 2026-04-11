import axiosInstance from "@/lib/api/axios";
import {
  ApiResponse,
  Coach,
  CoachVerificationStatus,
  RoleTemplate,
} from "@/types";

export interface Admin {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string; // Changed from "SUPER_ADMIN" | "ADMIN" to string for new role system
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLogin?: string;
}

export interface ModerationReview {
  _id: string;
  bookingId: string;
  targetType: "VENUE" | "COACH";
  rating: number;
  review?: string;
  moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REMOVED";
  reportCount: number;
  moderationNotes?: string;
  createdAt: string;
}

export interface UserSafetyRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "PLAYER" | "COACH" | "VENUE_LISTER";
  isActive: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  deactivatedAt?: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface CommunityReportRecord {
  id: string;
  reporterUserId: string;
  targetType: "MESSAGE" | "GROUP";
  targetId: string;
  reason: string;
  details?: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionNote?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface PromoCodeRecord {
  _id: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  applicableTo: "ALL" | "VENUE_ONLY" | "COACH_ONLY";
  minBookingAmount?: number;
  maxDiscountAmount?: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  maxUsageTotal?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  createdAt: string;
}

export interface PromoCodeStats {
  code: string;
  totalUsage: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
  recentUsages: Array<{
    userId: string;
    discountApplied: number;
    usedAt: string;
  }>;
}

export interface SupportTicketRecord {
  _id: string;
  subject: string;
  description: string;
  category: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  assignedAdminId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeAdmin = (admin: Partial<Admin> | null | undefined): Admin => {
  const normalizedId = admin?.id || admin?._id || "";

  return {
    id: normalizedId,
    _id: admin?._id,
    name: admin?.name || "",
    email: admin?.email || "",
    role: admin?.role || "SUPPORT_ADMIN",
    permissions: Array.isArray(admin?.permissions) ? admin.permissions : [],
    isActive: Boolean(admin?.isActive),
    ...(typeof admin?.mustChangePassword === "boolean"
      ? { mustChangePassword: admin.mustChangePassword }
      : {}),
    ...(admin?.lastLogin ? { lastLogin: admin.lastLogin } : {}),
  };
};

export const adminApi = {
  login: async (data: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ admin: Admin; token: string }>> => {
    const response = await axiosInstance.post("/admin/login", data);
    if (response.data?.data?.admin) {
      response.data.data.admin = normalizeAdmin(response.data.data.admin);
    }
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post("/admin/logout");
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.get("/admin/profile");
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  updateProfile: async (data: {
    name?: string;
    email?: string;
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.put("/admin/profile", data);
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  createAdmin: async (data: {
    name: string;
    email: string;
    role?: string;
    permissions?: string[];
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.post("/admin/create", data);
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.post("/admin/change-password", data);
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  getAllAdmins: async (): Promise<ApiResponse<Admin[]>> => {
    const response = await axiosInstance.get("/admin/list");
    if (Array.isArray(response.data?.data)) {
      response.data.data = response.data.data.map((admin: Admin) =>
        normalizeAdmin(admin),
      );
    }
    return response.data;
  },

  getRoleTemplates: async (): Promise<ApiResponse<RoleTemplate[]>> => {
    const response = await axiosInstance.get("/admin/role-templates");
    return response.data;
  },

  updateAdminPermissions: async (
    adminId: string,
    permissions: string[],
  ): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.put(`/admin/${adminId}/permissions`, {
      permissions,
    });
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  updateAdminRole: async (
    adminId: string,
    role: string,
  ): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.put(`/admin/${adminId}/role`, {
      role,
    });
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  getCoachVerifications: async (params?: {
    status?: CoachVerificationStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Coach[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const response = await axiosInstance.get(
      `/admin/coaches/verification?${query.toString()}`,
    );
    return response.data;
  },

  getCoachVerificationById: async (
    coachId: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.get(`/admin/coaches/${coachId}`);
    return response.data;
  },

  approveCoachVerification: async (
    coachId: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/verify`,
    );
    return response.data;
  },

  rejectCoachVerification: async (
    coachId: string,
    reason: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/reject`,
      { reason },
    );
    return response.data;
  },

  markCoachVerificationForReview: async (
    coachId: string,
    notes?: string,
  ): Promise<ApiResponse<Coach>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/mark-review`,
      { notes },
    );
    return response.data;
  },

  notifyCoachVerification: async (
    coachId: string,
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/notify`,
    );
    return response.data;
  },

  processRefund: async (
    bookingId: string,
    data: {
      refundType: "FULL" | "PARTIAL" | "VENUE_ONLY" | "COACH_ONLY";
      reason: string;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/refunds/${bookingId}`,
      data,
    );
    return response.data;
  },

  handleDispute: async (
    bookingId: string,
    data: {
      disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
      resolution: "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND";
      evidence?: string;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/disputes/${bookingId}`,
      data,
    );
    return response.data;
  },

  getReviewModerationQueue: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ModerationReview[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/reviews/moderation/queue?${params.toString()}`,
    );
    return response.data;
  },

  moderateReview: async (
    reviewId: string,
    data: {
      action: "APPROVE" | "REMOVE" | "HIDE";
      moderationNotes?: string;
    },
  ): Promise<ApiResponse<ModerationReview>> => {
    const response = await axiosInstance.patch(
      `/reviews/${reviewId}/moderate`,
      data,
    );
    return response.data;
  },

  getUserSafetyList: async (params?: {
    role?: "PLAYER" | "COACH" | "VENUE_LISTER";
    status?: "ACTIVE" | "SUSPENDED";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<UserSafetyRecord[]>> => {
    const query = new URLSearchParams();
    if (params?.role) query.append("role", params.role);
    if (params?.status) query.append("status", params.status);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const response = await axiosInstance.get(
      `/admin/users/safety?${query.toString()}`,
    );
    return response.data;
  },

  updateUserSafety: async (
    userId: string,
    data: {
      action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE";
      reason?: string;
    },
  ): Promise<ApiResponse<UserSafetyRecord>> => {
    const response = await axiosInstance.patch(
      `/admin/users/${userId}/safety`,
      data,
    );
    return response.data;
  },

  getCommunityReports: async (params?: {
    status?: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<CommunityReportRecord[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    const response = await axiosInstance.get(
      `/admin/community/reports?${query.toString()}`,
    );
    return response.data;
  },

  reviewCommunityReport: async (
    reportId: string,
    payload: {
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    },
  ): Promise<
    ApiResponse<{ id: string; status: string; reviewedAt: string }>
  > => {
    const response = await axiosInstance.patch(
      `/admin/community/reports/${reportId}`,
      payload,
    );
    return response.data;
  },

  getSupportTickets: async (params?: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<SupportTicketRecord[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.priority) query.append("priority", params.priority);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const response = await axiosInstance.get(
      `/support-tickets/admin?${query.toString()}`,
    );
    return response.data;
  },

  updateSupportTicket: async (
    ticketId: string,
    data: {
      status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assignedAdminId?: string | null;
      note?: string;
    },
  ): Promise<ApiResponse<SupportTicketRecord>> => {
    const response = await axiosInstance.patch(
      `/support-tickets/admin/${ticketId}`,
      data,
    );
    return response.data;
  },

  listPromoCodes: async (): Promise<ApiResponse<PromoCodeRecord[]>> => {
    const response = await axiosInstance.get("/admin/promo-codes");
    return response.data;
  },

  createPromoCode: async (data: {
    code: string;
    description: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    applicableTo?: "ALL" | "VENUE_ONLY" | "COACH_ONLY";
    minBookingAmount?: number;
    maxDiscountAmount?: number;
    validFrom: string;
    validUntil: string;
    maxUsageTotal?: number;
    maxUsagePerUser?: number;
  }): Promise<ApiResponse<PromoCodeRecord>> => {
    const response = await axiosInstance.post("/admin/promo-codes", data);
    return response.data;
  },

  deactivatePromoCode: async (
    codeId: string,
  ): Promise<ApiResponse<PromoCodeRecord>> => {
    const response = await axiosInstance.patch(
      `/admin/promo-codes/${codeId}/deactivate`,
    );
    return response.data;
  },

  getPromoCodeStats: async (
    codeId: string,
  ): Promise<ApiResponse<PromoCodeStats>> => {
    const response = await axiosInstance.get(
      `/admin/promo-codes/${codeId}/stats`,
    );
    return response.data;
  },
};
