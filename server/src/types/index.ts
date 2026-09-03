// ============================================
// ROLE & ENUM TYPES
// ============================================
// UserRole, BookingStatus, OCCUPYING_BOOKING_STATUSES,
// CANCELLABLE_BOOKING_STATUSES, PaymentUserType, PaymentStatus and
// ApiResponse now live in @powermysport/shared-types — this was the
// canonical source they were copied from into admin's and client's
// independent (and drifted) local copies, so this is the one declaration
// site all four apps import from.
import type {
  UserRole,
  PaymentUserType,
  PaymentStatus,
  ApiResponse,
  BookingStatus,
} from "@powermysport/shared-types";
export type { UserRole, PaymentUserType, PaymentStatus, ApiResponse, BookingStatus };
export {
  OCCUPYING_BOOKING_STATUSES,
  CANCELLABLE_BOOKING_STATUSES,
} from "@powermysport/shared-types";

// Admin role types
export type AdminRole =
  "SUPPORT_ADMIN" | "OPERATIONS_ADMIN" | "FINANCE_ADMIN" | "ANALYTICS_ADMIN" | "SYSTEM_ADMIN";

export type Permission = string; // e.g., "users:view", "venues:manage"

export interface RoleTemplate {
  role: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";

// ============================================
// USER TYPES
// ============================================

// IUser, IPlayerProfile, IBusinessDetails, IPayoutInfo and IVenueListerProfile
// were all dead code — declared here, never imported anywhere else in the
// server, superseded long ago by the real Mongoose model in
// client/models/User.ts. Removed rather than migrated.

export interface IUserPayload {
  id: string;
  email: string;
  role: UserRole | AdminRole;
  jti?: string;
  exp?: number;
  iat?: number;
}

// ============================================
// COACH TYPES
// ============================================
export interface IAvailability {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

/**
 * Venue details stored in coach profile for OWN_VENUE coaches.
 * These venues are NOT listed in the marketplace - they exist only for coach bookings.
 * Coaches who want to rent out venues separately must create a venue-lister account.
 */
export interface IOwnVenueDetails {
  name: string;
  address: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  sports: string[];
  amenities?: string[];
  pricePerHour: number;
  description?: string;
  images?: string[];
  imageS3Keys?: string[];
  openingHours?: string;
}

export interface ICoach {
  id?: string;
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  ownVenueDetails?: IOwnVenueDetails; // For OWN_VENUE/HYBRID coaches - venue info for bookings only
  baseLocation?: {
    // For FREELANCE coaches: their home/office location
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  serviceRadiusKm?: number; // Required if FREELANCE/HYBRID
  travelBufferTime?: number; // Minutes, required if FREELANCE/HYBRID
  availability: IAvailability[];
  availabilityBySport?: Record<string, IAvailability[]>;
  onboardingProgressStep?: 1 | 2 | 3;
  verificationDocuments?: Array<{
    type: "CERTIFICATION" | "ID_PROOF" | "BACKGROUND_CHECK" | "INSURANCE" | "OTHER";
    url: string;
    s3Key?: string; // S3 key for document
    fileName: string;
    uploadedAt: Date;
  }>;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  gstNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// VENUE TYPES
// ============================================
export interface IGeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface DayHours {
  isOpen: boolean;
  openTime?: string; // Format: "HH:MM" (24-hour)
  closeTime?: string; // Format: "HH:MM" (24-hour)
  slots?: Array<{
    startTime: string; // Format: "HH:MM" (24-hour)
    endTime: string; // Format: "HH:MM" (24-hour)
  }>;
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface IVenue {
  id?: string;
  name: string;
  ownerId: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  description: string;
  images: string[];
  coverPhotoUrl?: string;
  allowExternalCoaches: boolean;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  documents?: IVenueDocument[];
  rating: number;
  reviewCount: number;
  gstNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// ACADEMY TYPES
// ============================================

export interface IAcademyPendingReview {
  id: string;
  name: string;
  legalName: string;
  city: string;
  sports: string[];
  ownerEmail: string;
  ownerPhone: string;
  isApproved: boolean;
  kycVerified: boolean;
  submittedAt?: Date;
  lastReviewedAt?: Date;
}

export interface IAcademyDocument {
  type: "panDocument" | "gstDocument";
  url: string;
  s3Key?: string;
  fileName: string;
  uploadedAt: Date;
}

// ============================================
// VENUE ONBOARDING TYPES
// ============================================
export interface IVenueDocument {
  type: "OWNERSHIP_PROOF" | "BUSINESS_REGISTRATION" | "TAX_DOCUMENT" | "INSURANCE" | "CERTIFICATE";
  url: string;
  s3Key?: string; // S3 object key for regenerating presigned URLs
  fileName: string;
  uploadedAt: Date;
}

export interface IVenueOnboardingStep1 {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

export interface IVenueOnboardingStep2 {
  venueId: string;
  name: string;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  address: string;
  openingHours: OpeningHours;
  description: string;
  allowExternalCoaches: boolean;
  location: IGeoLocation;
}

export interface IVenueOnboardingStep3 {
  venueId: string;
  images: string[]; // S3 URLs from client upload - LEGACY
  imageKeys: string[]; // S3 keys for regenerating URLs - LEGACY
  generalImages?: string[]; // General venue images (3 required)
  generalImageKeys?: string[]; // S3 keys for general images
  sportImages?: Record<string, string[]>; // Sport-specific images (5 per sport)
  sportImageKeys?: Record<string, string[]>; // S3 keys for sport images
  coverPhotoUrl: string; // S3 URL for cover shot
  coverPhotoKey: string; // S3 key for cover photo
}

export interface IVenueOnboardingStep4 {
  venueId: string;
  images: string[]; // S3 URLs from client upload - LEGACY
  imageKeys: string[]; // S3 keys for regenerating URLs - LEGACY
  generalImages?: string[]; // General venue images (3 required)
  generalImageKeys?: string[]; // S3 keys for general images
  sportImages?: Record<string, string[]>; // Sport-specific images (5 per sport)
  sportImageKeys?: Record<string, string[]>; // S3 keys for sport images
  coverPhotoUrl: string; // S3 URL for cover shot
  coverPhotoKey: string; // S3 key for cover photo
  documents: {
    type:
      "OWNERSHIP_PROOF" | "BUSINESS_REGISTRATION" | "TAX_DOCUMENT" | "INSURANCE" | "CERTIFICATE";
    url: string;
    s3Key?: string; // S3 object key for regenerating URLs
    fileName: string;
  }[];
}

export interface IOnboardingUploadUrl {
  field: string; // image_0, document_OWNERSHIP_PROOF, etc.
  uploadUrl: string;
  downloadUrl: string;
  s3Key?: string; // S3 object key (for documents)
  fileName: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface IPendingVenue {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPhone: string;
  sports: string[];
  approvalStatus: "PENDING" | "REVIEW" | "REJECTED";
  submittedAt: Date;
  lastReviewedAt?: Date;
}

// ============================================
// BOOKING TYPES
// ============================================
// PaymentUserType, PaymentStatus and ApiResponse are re-exported from
// @powermysport/shared-types at the top of this file.

export interface IPayment {
  userId: string;
  userType: PaymentUserType;
  /** Payee entries carry the NET payable; see BookingPayment.amount. */
  amount: number;
  grossAmount?: number;
  commissionAmount?: number;
  commissionGstAmount?: number;
  commissionRate?: number;
  status: PaymentStatus;
  paidAt?: Date;
}

// IBooking and AuthResponse were dead code too — same story as IUser above,
// superseded by the real Mongoose model in client/models/Booking.ts.
