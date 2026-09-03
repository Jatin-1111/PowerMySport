// ============================================
// USER & AUTH TYPES
// ============================================
// UserRole, BookingStatus, PaymentUserType, PaymentStatus, VenueListerProfile
// and the base User shape now live in @powermysport/shared-types — this file
// previously had its own independent copy of each, which had drifted from
// both the server model and client's copy (missing "VENUE_ONBOARDING" on
// UserRole, missing "Expert"/"Player" on PaymentUserType, missing most
// moderation/address fields on User entirely). See that package for the
// merge notes.
import type {
  UserRole,
  BookingStatus,
  PaymentUserType,
  PaymentStatus,
  VenueListerProfile,
  User as SharedUser,
} from "@powermysport/shared-types";
export type { UserRole, BookingStatus, PaymentUserType, PaymentStatus, VenueListerProfile };

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

export interface IPayment {
  userId: string;
  userType: PaymentUserType;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
}

export interface Dependent {
  _id?: string;
  name: string;
  dob: string; // ISO date string
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sports?: string[];
}

/** admin always has `id` (never optional here) and `dependents` is a real
 *  typed array in this app (the shared type keeps it loose — see that
 *  package's note on why). */
export interface User extends Omit<SharedUser, "id" | "dependents"> {
  id: string;
  dependents?: Dependent[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
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
  location: IGeoLocation;
  sports: string[];
  amenities?: string[];
  pricePerHour: number;
  description?: string;
  images?: string[];
  imageS3Keys?: string[];
  openingHours?: string;
}

export type CoachVerificationStatus = "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";

export interface CoachVerificationDocument {
  type: "CERTIFICATION" | "ID_PROOF" | "ADDRESS_PROOF" | "BACKGROUND_CHECK" | "INSURANCE" | "OTHER";
  url: string;
  s3Key?: string;
  fileName: string;
  uploadedAt?: string;
}

export interface Coach {
  _id?: string;
  id: string;
  userId:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
      };
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  ownVenueDetails?: IOwnVenueDetails; // Venue details stored in coach profile for bookings only (not marketplace)
  baseLocation?: IGeoLocation;
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  availability: IAvailability[];
  availabilityBySport?: Record<string, IAvailability[]>;
  verificationDocuments?: CoachVerificationDocument[];
  verificationStatus?: CoachVerificationStatus;
  verificationNotes?: string;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  isVerified?: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// VENUE TYPES
// ============================================
export interface IGeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Venue {
  _id?: string;
  id: string;
  name: string;
  ownerId: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  address?: string;
  amenities: string[];
  description: string;
  images: string[];
  imageKeys?: string[]; // S3 keys for venue images (regenerate URLs as needed)
  coverPhotoUrl?: string;
  coverPhotoKey?: string; // S3 key for cover photo (regenerate URL as needed)
  allowExternalCoaches: boolean;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BOOKING TYPES
// ============================================
// Everything on the canonical Booking (group-booking fields, expert/delivery
// details, the full cancellation/completion lifecycle) now lives in
// @powermysport/shared-types — this app previously had none of that typed
// at all, not even as optional. The populated-reference fields below
// (venue/coach/*Name) are an admin-only convenience the API layer adds on
// top, so they stay here rather than in the shared shape.
import type { Booking as SharedBooking } from "@powermysport/shared-types";

export interface Booking extends Omit<
  SharedBooking,
  "venueId" | "coachId" | "createdAt" | "updatedAt"
> {
  playerName?: string;
  venueId?: string | Venue; // Can be populated
  venueName?: string;
  venue?: Venue; // Populated venue data
  coachId?: string | Coach; // Can be populated
  coach?: Coach; // Populated coach data
  coachName?: string;
  academyName?: string;
  expertName?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export type { PaginationMetadata, ApiResponse } from "@powermysport/shared-types";

export interface Availability {
  availableSlots: string[];
  bookedSlots: Array<{
    startTime: string;
    endTime: string;
  }>;
}

export interface DiscoveryResponse {
  venues: Venue[];
  coaches: Coach[];
}

export interface InitiateBookingResponse {
  booking: Booking;
}
