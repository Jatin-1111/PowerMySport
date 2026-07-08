import axiosInstance from "@/lib/api/axios";
import {
  ApiResponse,
  CoachVerificationDocument,
  Coach,
  CoachVerificationStatus,
  RoleTemplate,
} from "@/types";

type OpeningHoursDay = {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

type OpeningHours = {
  monday: OpeningHoursDay;
  tuesday: OpeningHoursDay;
  wednesday: OpeningHoursDay;
  thursday: OpeningHoursDay;
  friday: OpeningHoursDay;
  saturday: OpeningHoursDay;
  sunday: OpeningHoursDay;
};

// ─── Sport Pathways ─────────────────────────────────────────────────────────

export interface AdminPathwayBenchmarkMetric {
  metric: string;
  target: string;
}

export interface AdminPathwayGovernmentScheme {
  name: string;
  body: string;
  eligibility: string;
  benefit: string;
  howToApply: string;
}

export interface AdminPathwayLevel {
  level: number;
  label: string;
  title: string;
  description: string;
  keyFocus: string;
  ageRange: string;
  competitions: string;
  steps: string[];
  governingBody?: string;
  localResources?: {
    academies?: string[];
    facilities?: string[];
    governingBodies?: string[];
  };
  benchmarks?: {
    description?: string;
    metrics?: AdminPathwayBenchmarkMetric[];
  };
  trialInfo?: {
    typicalMonths?: string;
    registrationProcess?: string;
    eligibilityAge?: string;
    selectionCriteria?: string[];
    tips?: string[];
  };
  injuryRisks?: {
    commonInjuries?: string[];
    preventionTips?: string[];
    warningSignsToWatch?: string[];
  };
  talentSignals?: {
    physicalMarkers?: string[];
    cognitiveMarkers?: string[];
    behavioralMarkers?: string[];
  };
  mentalSkillsFocus?: string[];
  coachSelectionGuide?: {
    mustHave?: string[];
    niceToHave?: string[];
    redFlags?: string[];
    questionsToAsk?: string[];
  };
  governmentSchemes?: AdminPathwayGovernmentScheme[];
  academicIntegration?: string;
  proactiveDocuments?: string[];
}

export interface AdminPathwayEquipment {
  level: string;
  items: string[];
  estimatedCost: string;
}

export interface AdminPathwayCareer {
  role: string;
  description: string;
  demand: string;
}

export interface AdminSportPathway {
  _id: string;
  sportSlug: string;
  sportName: string;
  cacheKey?: string;
  category?: string;
  overview: string;
  levels: AdminPathwayLevel[];
  equipment: AdminPathwayEquipment[];
  careers: AdminPathwayCareer[];
  isVerified: boolean;
  verifiedAt?: string;
  verifiedBy?: string | { _id: string; name?: string; email?: string };
  lookupCount: number;
  lastRefreshedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AcademyAdminQueueRecord {
  id: string;
  name: string;
  legalName?: string;
  city?: string;
  sports: string[];
  ownerEmail?: string;
  ownerPhone?: string;
  isApproved?: boolean;
  kycVerified?: boolean;
  isActive?: boolean;
  submittedAt?: string;
  lastReviewedAt?: string;
  rejectionReason?: string;
}

export interface AcademyAdminReviewDetails extends AcademyAdminQueueRecord {
  slug?: string;
  description?: string;
  address?: string;
  state?: string;
  pincode?: string;
  placeId?: string;
  logoUrl?: string;
  coverPhotoUrl?: string;
  photos?: string[];
  ageGroups?: string[];
  operatingHours?: OpeningHours;
  languagesSpoken?: string[];
  contactEmail?: string;
  contactPhone?: string;
  contactPersonName?: string;
  allowsExternalCoaches?: boolean;
  maxBatchSize?: number;
  batchTimings?: string[];
  sessionRatePerHour?: number;
  trialsessionOffered?: boolean;
  trialSessionPrice?: number;
  bankAccountName?: string;
  bankIfsc?: string;
  upiId?: string;
  payoutFrequency?: "weekly" | "biweekly" | "monthly";
  cancellationPolicy?: string;
  refundPolicy?: string;
  panNumber?: string;
  panDocumentUrl?: string;
  gstNumber?: string;
  gstDocumentUrl?: string;
  ownerId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  venueIds?: Array<string | { _id?: string; id?: string; name?: string }>;
  coachIds?: Array<string | { _id?: string; id?: string; name?: string }>;
  subscriptionPlans?: Array<
    string | { _id?: string; id?: string; name?: string }
  >;
  sessionPackages?: Array<
    string | { _id?: string; id?: string; name?: string }
  >;
  rating?: number;
  reviewCount?: number;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
}

interface AcademyPendingQueueResponse {
  academies: AcademyAdminQueueRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminAuditLogEntry {
  id: string;
  admin: { id: string; name?: string; email: string } | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Admin {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string; // Changed from "SUPER_ADMIN" | "Admin" to string for new role system
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLogin?: string;
}

export interface ModerationReview {
  _id: string;
  bookingId: string;
  userId: string | { _id?: string; id?: string; name?: string; email?: string };
  targetType: "VENUE" | "Coach";
  targetId: string | { _id?: string; id?: string; name?: string };
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
  role: "Player" | "Coach" | "VenueLister";
  isActive: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  deactivatedAt?: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface CommunityReportRecord {
  id: string;
  reporterUserId: { id: string; name: string; email: string };
  targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
  targetId: string;
  targetPreview: string;
  targetDeleted: boolean;
  reason: string;
  details?: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionNote?: string;
  reviewedBy?: { id: string; name: string } | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface PromoCodeRecord {
  _id: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  applicableTo: "ALL" | "VENUE_ONLY" | "COACH_ONLY" | "MERCHANDISE_ONLY";
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
    userName: string;
    userEmail: string;
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
  userId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterType?:
    "player" | "venue_owner" | "coach" | "academy_owner" | "other";
  assignedAdminId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPhonePeRefundTransaction {
  merchantOrderId: string;
  merchantRefundId: string;
  refundId?: string;
  state?: string;
  amount: number;
}

export interface AdminPhonePeRefundStatus {
  bookingId: string;
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount: number;
  transactions: AdminPhonePeRefundTransaction[];
}

export interface PayoutSummary {
  vendorId: string;
  vendorRole: "VenueLister" | "Coach" | "Expert";
  totalPendingAmount: number;
  bookingIds: string[];
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  payoutMethod: any | null;
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

  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AdminAuditLogEntry[]>> => {
    const response = await axiosInstance.get("/admin/audit-logs", {
      params,
    });
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

  updateAdminProfile: async (
    adminId: string,
    name: string,
  ): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.patch(`/admin/${adminId}/profile`, {
      name,
    });
    if (response.data?.data) {
      response.data.data = normalizeAdmin(response.data.data);
    }
    return response.data;
  },

  updateAdminStatus: async (
    adminId: string,
    isActive: boolean,
  ): Promise<ApiResponse<Admin>> => {
    const response = await axiosInstance.patch(`/admin/${adminId}/status`, {
      isActive,
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

  getCoaches: async (params?: {
    status?: CoachVerificationStatus | "ALL";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Coach[]>> => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") {
      query.append("status", params.status);
    }
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const response = await axiosInstance.get(
      `/admin/coaches${query.toString() ? `?${query.toString()}` : ""}`,
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
      refundType: "FULL" | "PARTIAL";
      reason: string;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/refunds/${bookingId}`,
      data,
    );
    return response.data;
  },

  getPhonePeRefundStatus: async (
    bookingId: string,
  ): Promise<ApiResponse<AdminPhonePeRefundStatus>> => {
    const response = await axiosInstance.get(
      `/admin/refunds/${bookingId}/status`,
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

  /**
   * Fetch bookings that have a pending or initiated refund status
   * Used by the admin refunds management page to populate the refund queue
   */
  getPendingRefundBookings: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<unknown[]> & {
      stats?: {
        pendingCount: number;
        completedCount: number;
        failedCount: number;
        totalAmount: number;
      };
    }
  > => {
    const query = new URLSearchParams();
    query.append("refundStatus", "PENDING");
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const response = await axiosInstance.get(
      `/admin/refunds?${query.toString()}`,
    );
    return response.data;
  },

  getFailedRefundBookings: async (): Promise<ApiResponse<unknown[]>> => {
    const response = await axiosInstance.get(
      `/admin/refunds?refundStatus=REJECTED&limit=100`,
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
    role?: "Player" | "Coach" | "VenueLister";
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

  bulkReviewCommunityReports: async (payload: {
    reportIds: string[];
    status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
    resolutionNote?: string;
  }): Promise<ApiResponse<{ modifiedCount: number }>> => {
    const response = await axiosInstance.patch(
      `/admin/community/reports/bulk-review`,
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

  // ===== NEW: Admin Venue & Coach Creation =====

  createVenue: async (data: {
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    name: string;
    address: string;
    sports: string[];
    pricePerHour: number;
    sportPricing?: Record<string, number>;
    amenities?: string[];
    description?: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
    openingHours?: OpeningHours;
    allowExternalCoaches?: boolean;
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  }): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post("/admin/venues/create", data);
    return response.data;
  },

  updateVenue: async (
    venueId: string,
    data: {
      name?: string;
      address?: string;
      sports?: string[];
      pricePerHour?: number;
      sportPricing?: Record<string, number>;
      amenities?: string[];
      description?: string;
      location?: {
        type: "Point";
        coordinates: [number, number];
      };
      openingHours?: OpeningHours;
      allowExternalCoaches?: boolean;
      approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
      generalImages?: string[];
      generalImageKeys?: string[];
      sportImages?: Record<string, string[]>;
      sportImageKeys?: Record<string, string[]>;
      coverPhotoUrl?: string;
      coverPhotoKey?: string;
      convertExistingUser?: boolean;
    },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(`/admin/venues/${venueId}`, data);
    return response.data;
  },

  createCoach: async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mobileNumber?: string;
    bio?: string;
    sports: string[];
    certifications?: string[];
    hourlyRate: number;
    sportPricing?: Record<string, number>;
    serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    baseLocation?: {
      type: "Point";
      coordinates: [number, number];
    };
    ownVenueDetails?: {
      name: string;
      address: string;
      description?: string;
      openingHours?: string;
      images?: string[];
      imageS3Keys?: string[];
      location?: {
        type: "Point";
        coordinates: [number, number];
      };
    };
    serviceRadiusKm?: number;
    travelBufferTime?: number;
    venueId?: string;
    profilePhotoUrl?: string;
    profilePhotoKey?: string;
    verificationStatus?:
      "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";
    convertExistingUser?: boolean;
  }): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post("/admin/coaches/create", data);
    return response.data;
  },

  getCoachPhotoUploadUrl: async (
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
      "/admin/coaches/photo-upload-url",
      {
        fileName,
        contentType,
      },
    );
    return response.data;
  },

  getCoachVerificationUploadUrl: async (
    coachId: string,
    payload: {
      fileName: string;
      contentType: string;
      documentType?: string;
      purpose?: "DOCUMENT" | "VENUE_IMAGE";
    },
  ): Promise<
    ApiResponse<{
      uploadUrl: string;
      downloadUrl: string;
      key: string;
      fileName?: string;
    }>
  > => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/verification/upload-url`,
      payload,
    );
    return response.data;
  },

  updateCoach: async (
    coachId: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(`/admin/coaches/${coachId}`, data);
    return response.data;
  },

  submitCoachVerificationAdmin: async (
    coachId: string,
    payload: { documents?: CoachVerificationDocument[] },
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post(
      `/admin/coaches/${coachId}/verification/submit`,
      payload,
    );
    return response.data;
  },

  getPendingAcademies: async (params?: {
    page?: number;
    limit?: number;
    filter?: "pending" | "approved" | "rejected";
  }): Promise<ApiResponse<AcademyPendingQueueResponse>> => {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));
    if (params?.filter) query.append("filter", params.filter);

    const response = await axiosInstance.get(
      `/academies/admin/pending${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return response.data;
  },

  getAcademyReviewDetails: async (
    academyId: string,
  ): Promise<ApiResponse<AcademyAdminReviewDetails>> => {
    const response = await axiosInstance.get(
      `/academies/admin/${academyId}/review`,
    );
    return response.data;
  },

  approveAcademy: async (academyId: string): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(
      `/academies/admin/${academyId}/approve`,
    );
    return response.data;
  },

  rejectAcademy: async (
    academyId: string,
    rejectionReason: string,
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(
      `/academies/admin/${academyId}/reject`,
      {
        rejectionReason,
      },
    );
    return response.data;
  },

  markAcademyKycVerified: async (
    academyId: string,
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(
      `/academies/admin/${academyId}/kyc-verify`,
    );
    return response.data;
  },

  suspendAcademy: async (
    academyId: string,
    reason?: string,
  ): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.put(
      `/academies/admin/${academyId}/suspend`,
      {
        reason,
      },
    );
    return response.data;
  },

  getPendingPayouts: async (): Promise<ApiResponse<PayoutSummary[]>> => {
    const response = await axiosInstance.get("/admin/payouts/pending");
    return response.data;
  },

  markPayoutsAsPaid: async (data: {
    vendorId: string;
    vendorRole: "VenueLister" | "Coach" | "Expert";
    bookingIds: string[];
  }): Promise<ApiResponse<unknown>> => {
    const response = await axiosInstance.post("/admin/payouts/mark-paid", data);
    return response.data;
  },

  getDisputes: async (): Promise<ApiResponse<any[]>> => {
    const response = await axiosInstance.get("/admin/disputes");
    return response.data;
  },

  getWebhookErrors: async (): Promise<ApiResponse<any[]>> => {
    const response = await axiosInstance.get("/admin/webhook-errors");
    return response.data;
  },

  retryWebhookError: async (key: string): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.post(
      `/admin/webhook-errors/${key}/retry`,
    );
    return response.data;
  },

  reconcileOrder: async (
    type: string,
    orderId: string,
  ): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.post(
      `/admin/reconcile/${type}/${orderId}`,
    );
    return response.data;
  },

  // ─── Sport Pathways ───────────────────────────────────────────────────────

  getPathways: async (params?: {
    search?: string;
    isVerified?: "true" | "false";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AdminSportPathway[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.isVerified) query.append("isVerified", params.isVerified);
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));
    const response = await axiosInstance.get(
      `/admin/sport-pathways${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return response.data;
  },

  getPathwayById: async (
    id: string,
  ): Promise<ApiResponse<AdminSportPathway>> => {
    const response = await axiosInstance.get(`/admin/sport-pathways/${id}`);
    return response.data;
  },

  updatePathway: async (
    id: string,
    data: Partial<
      Pick<
        AdminSportPathway,
        "overview" | "category" | "levels" | "equipment" | "careers"
      >
    >,
  ): Promise<ApiResponse<AdminSportPathway>> => {
    const response = await axiosInstance.patch(
      `/admin/sport-pathways/${id}`,
      data,
    );
    return response.data;
  },

  setPathwayVerified: async (
    id: string,
    verified: boolean,
  ): Promise<ApiResponse<AdminSportPathway>> => {
    const response = await axiosInstance.post(
      `/admin/sport-pathways/${id}/verify`,
      {
        verified,
      },
    );
    return response.data;
  },
};
