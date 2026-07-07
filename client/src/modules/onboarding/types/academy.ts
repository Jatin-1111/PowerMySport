// ============================================
// ACADEMY ONBOARDING TYPES
// ============================================

export interface AcademyDocument {
  type: "PAN" | "GST";
  url: string;
  s3Key: string;
  fileName: string;
}

export type AcademyBusinessType =
  "sole_proprietorship" | "partnership" | "pvt_ltd" | "ngo_trust";

export type AcademyBatchTiming = "morning" | "evening" | "both";

export type AcademyPayoutFrequency = "weekly" | "biweekly" | "monthly";

export type AcademyStepPayload =
  | AcademyStep1Payload
  | AcademyStep2Payload
  | AcademyStep3Payload
  | AcademyStep4Payload
  | AcademyStep5Payload
  | AcademyStep6Payload;

export interface AcademyOwner {
  name: string;
  email: string;
  phone: string; // +91XXXXXXXXXX format
}

export interface PresignedUrl {
  field: string;
  uploadUrl: string;
  downloadUrl: string;
  s3Key: string;
  fileName: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface OnboardingAcademy {
  id?: string;
  _id?: string;
  academyId?: string;

  // Identity
  name: string;
  legalName: string;
  slug?: string;
  description?: string;
  establishedYear?: number;

  // Images
  logoUrl?: string;
  logoKey?: string;
  coverPhotoUrl?: string;
  coverPhotoKey?: string;
  photos?: string[];
  photoKeys?: string[];

  // Sports & Demographics
  sports: string[];
  ageGroups: ("kids" | "teens" | "adults" | "all")[];

  // Location
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  placeId?: string;

  // Legal & Compliance
  businessType?:
    "sole_proprietorship" | "partnership" | "pvt_ltd" | "ngo_trust";
  panNumber?: string;
  panDocumentUrl?: string;
  panDocumentKey?: string;
  gstNumber?: string;
  gstDocumentUrl?: string;
  gstDocumentKey?: string;
  aadhaarLast4?: string;

  // Operational
  operatingHours?: Record<
    string,
    { isOpen: boolean; openTime?: string; closeTime?: string }
  >;
  languagesSpoken?: string[];
  contactPersonName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  allowsExternalCoaches?: boolean;
  maxBatchSize?: number;
  batchTimings?: ("morning" | "evening" | "both")[];

  // Relationships
  venueIds?: string[];
  coachIds?: string[];
  subscriptionPlans?: string[];
  sessionPackages?: string[];

  // Pricing
  sessionRatePerHour?: number;
  trialsessionOffered?: boolean;
  trialSessionPrice?: number;

  // Payouts
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountName?: string;
  upiId?: string;
  payoutFrequency?: "weekly" | "biweekly" | "monthly";
  cancellationPolicy?: string;
  refundPolicy?: string;

  // Status
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  isApproved?: boolean;
  kycVerified?: boolean;
  isActive?: boolean;
  rating?: number;
  reviewCount?: number;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// PAYLOAD TYPES FOR EACH STEP
// ============================================

export interface AcademyStep1Payload {
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string; // +91XXXXXXXXXX
  name: string;
  legalName: string;
  sports: string[];
  ageGroups: ("kids" | "teens" | "adults" | "all")[];
  establishedYear?: number;
  description: string;
  logoUrl?: string;
  logoKey?: string;
}

export interface AcademyStep2Payload {
  academyId: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address: string;
  city: string;
  state: string;
  pincode: string;
  placeId?: string;
  contactPersonName: string;
  contactPhone: string; // +91XXXXXXXXXX
  contactEmail: string;
  whatsappNumber: string; // +91XXXXXXXXXX
  languagesSpoken: string[];
}

export interface AcademyStep3Payload {
  academyId: string;
  businessType: "sole_proprietorship" | "partnership" | "pvt_ltd" | "ngo_trust";
  panNumber: string;
  panDocumentUrl: string;
  panDocumentKey: string;
  gstNumber?: string;
  gstDocumentUrl?: string;
  gstDocumentKey?: string;
  aadhaarLast4: string; // Last 4 digits only
}

export interface AcademyStep4Payload {
  academyId: string;
  allowsExternalCoaches: boolean;
  venueIds?: string[];
  coachIds?: string[];
}

export interface AcademyStep5Payload {
  academyId: string;
  sessionRatePerHour: number; // In paise
  batchTimings: ("morning" | "evening" | "both")[];
  maxBatchSize: number;
  trialsessionOffered: boolean;
  trialSessionPrice?: number; // In paise
}

export interface AcademyStep6Payload {
  academyId: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
  upiId: string;
  payoutFrequency: "weekly" | "biweekly" | "monthly";
  cancellationPolicy: string;
  refundPolicy: string;
}

export interface ConfirmImagesPayload {
  academyId: string;
  logoUrl?: string;
  logoKey?: string;
  coverPhotoUrl?: string;
  coverPhotoKey?: string;
  galleryPhotoUrls?: string[];
  galleryPhotoKeys?: string[];
}

export interface ConfirmDocumentsPayload {
  academyId: string;
  panDocumentUrl: string;
  panDocumentKey: string;
  gstDocumentUrl?: string;
  gstDocumentKey?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface OnboardingProgress {
  academyId: string;
  currentStep: number;
  completedSteps: number[];
  data: Record<string, unknown>;
}

export interface UploadedImage {
  field: string;
  key: string;
  url: string;
}

export interface UploadedDocument {
  type: string;
  fileName: string;
  url: string;
  s3Key: string;
}

export interface AcademyListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AcademyListResponse {
  academies: OnboardingAcademy[];
  pagination: AcademyListPagination;
}
