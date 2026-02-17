// ============================================
// ROLE & ENUM TYPES
// ============================================
export type UserRole = "PLAYER" | "VENUE_LISTER" | "COACH" | "ADMIN";
export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";
export type PaymentStatus = "PENDING" | "PAID";
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PROGRESS" // Booking started, check-in completed
  | "COMPLETED" // Booking finished successfully
  | "NO_SHOW" // User didn't show up
  | "CANCELLED"
  | "EXPIRED";

// ============================================
// USER TYPES
// ============================================
export interface IPaymentHistory {
  bookingId: string;
  amount: number;
  date: Date;
}

export interface IPlayerProfile {
  paymentHistory: IPaymentHistory[];
}

export interface IBusinessDetails {
  name: string;
  gstNumber?: string;
  address: string;
}

export interface IPayoutInfo {
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface IVenueListerProfile {
  businessDetails: IBusinessDetails;
  payoutInfo: IPayoutInfo;
  canAddMoreVenues?: boolean;
}

export interface IUser {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
  photoUrl?: string;
  photoS3Key?: string; // S3 key for profile picture
  playerProfile?: IPlayerProfile;
  venueListerProfile?: IVenueListerProfile;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

// ============================================
// COACH TYPES
// ============================================
export interface IAvailability {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

export interface ICoach {
  id?: string;
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  serviceMode: ServiceMode;
  venueId?: string; // Required if OWN_VENUE
  baseLocation?: {
    // For FREELANCE coaches: their home/office location
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  serviceRadiusKm?: number; // Required if FREELANCE/HYBRID
  travelBufferTime?: number; // Minutes, required if FREELANCE/HYBRID
  availability: IAvailability[];
  verificationDocuments?: Array<{
    type:
      | "CERTIFICATION"
      | "ID_PROOF"
      | "BACKGROUND_CHECK"
      | "INSURANCE"
      | "OTHER";
    url: string;
    s3Key?: string; // S3 key for document
    fileName: string;
    uploadedAt: Date;
  }>;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
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
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// VENUE ONBOARDING TYPES
// ============================================
export interface IVenueDocument {
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
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
      | "OWNERSHIP_PROOF"
      | "BUSINESS_REGISTRATION"
      | "TAX_DOCUMENT"
      | "INSURANCE"
      | "CERTIFICATE";
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
// BOOKING & PAYMENT TYPES
// ============================================
export interface IPayment {
  userId: string;
  userType: "VENUE_LISTER" | "COACH";
  amount: number;
  status: PaymentStatus;
  paymentLink?: string;
  paidAt?: Date;
}

export interface IBooking {
  id?: string;
  userId: string; // Player
  venueId: string;
  coachId?: string; // Optional
  date: Date;
  startTime: string; // "18:00"
  endTime: string; // "19:00"
  payments: IPayment[];
  totalAmount: number;
  status: BookingStatus;
  expiresAt: Date;
  verificationToken?: string;
  qrCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AuthResponse {
  token: string;
  user: IUser;
}
