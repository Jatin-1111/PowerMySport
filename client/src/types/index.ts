// ============================================
// USER & AUTH TYPES
// ============================================
export type UserRole = "PLAYER" | "VENUE_LISTER" | "COACH" | "ADMIN";
export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";
export type PaymentStatus = "PENDING" | "PAID";
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "EXPIRED";

export interface VenueListerProfile {
  businessDetails?: {
    name?: string;
    gstNumber?: string;
    address?: string;
  };
  payoutInfo?: {
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
  };
  canAddMoreVenues?: boolean;
}

export interface Dependent {
  _id?: string;
  name: string;
  dob: string; // ISO date string
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sports?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob?: string;
  role: UserRole;
  photoUrl?: string;
  photoS3Key?: string; // S3 key for profile picture
  venueListerProfile?: VenueListerProfile;
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

export type CoachVerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "REVIEW"
  | "VERIFIED"
  | "REJECTED";

export interface CoachVerificationDocument {
  type:
    | "CERTIFICATION"
    | "ID_PROOF"
    | "ADDRESS_PROOF"
    | "BACKGROUND_CHECK"
    | "INSURANCE"
    | "OTHER";
  url: string;
  s3Key?: string;
  fileName: string;
  uploadedAt?: string;
}

export interface Coach {
  _id?: string;
  id: string;
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  venueId?: string;
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
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BOOKING & PAYMENT TYPES
// ============================================
export interface IPayment {
  userId: string;
  userType: "VENUE_LISTER" | "COACH";
  amount: number;
  status: PaymentStatus;
  paymentLink?: string;
  paidAt?: string;
}

export interface Booking {
  id: string;
  userId: string;
  venueId: string;
  coachId?: string;
  sport?: string;
  date: string;
  startTime: string;
  endTime: string;
  payments: IPayment[];
  venuePayment?: {
    amount: number;
    status: string;
  };
  totalAmount: number;
  status: BookingStatus;
  expiresAt: string;
  verificationToken?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface PaginationMetadata {
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    // Allow nested pagination or top-level
    [key: string]: PaginationMetadata | undefined;
  } & PaginationMetadata; // Or just top-level
}

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
  paymentLinks: Array<{
    userId: string;
    userType: "VENUE_LISTER" | "COACH";
    amount: number;
    paymentLink: string;
  }>;
}
