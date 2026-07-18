// ============================================
// USER & AUTH TYPES
// ============================================
export interface IPlayerProfile {
  sportsFocus?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
}

export type UserRole =
  | "Player"
  | "Parent"
  | "VenueLister"
  | "Coach"
  | "Academy"
  | "EXPERT"
  | "Admin";
export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";
export type BookingStatus =
  | "PENDING_INVITES"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentUserType = "Player" | "VenueLister" | "Coach";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export interface IPayment {
  userId: string;
  userType: PaymentUserType;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
}

// Aligned with backend IVenueListerProfile type
export interface VenueListerProfile {
  businessDetails: {
    name: string;
    gstNumber?: string;
    address: string;
  };
  payoutInfo: {
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  canAddMoreVenues?: boolean;
}

export interface Dependent {
  _id?: string;
  name: string;
  dob: string; // ISO date string
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string; // Indian state
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
  // Wizard physical
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  // Wizard personality
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  // Wizard comfort
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  // Wizard practical
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "professional";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  trainingType?: "self" | "club" | "academy" | "private";
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string;
}

export interface UserShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isIdentityPublic?: boolean;
  dob?: string;
  role: UserRole;
  userType?:
    "Parent" | "Player" | "Coach" | "VenueLister" | "Admin" | "Academy";
  photoUrl?: string;
  photoS3Key?: string; // S3 key for profile picture
  googleId?: string;
  playerProfile?: IPlayerProfile;
  parentProfile?: {
    bio?: string;
    sportInterests?: string[];
    involvementYears?: number;
  };
  venueListerProfile?: VenueListerProfile;
  dependents?: Dependent[];
  shippingAddress?: UserShippingAddress;
  /** False for Google-only accounts that never set a password. */
  hasPassword?: boolean;
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

export type CoachVerificationStatus =
  "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";

export type CoachSubscriptionPackageFrequency =
  "MONTHLY" | "QUARTERLY" | "YEARLY";
export type CoachSubscriptionStatus =
  "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

export interface CoachSubscription {
  id?: string;
  _id?: string;
  coachId: string;
  userId: string;
  packageId?: string | CoachSubscriptionPackage | null;
  status: CoachSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  autoRenew: boolean;
  gracePeriodEndsAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachSubscriptionPackage {
  id?: string;
  _id?: string;
  coachId: string;
  name: string;
  description?: string;
  frequency: CoachSubscriptionPackageFrequency;
  price: number;
  features: string[];
  maxStudents?: number | null;
  maxSessions?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachSubscriptionPackageCreateInput {
  name: string;
  description?: string;
  frequency: CoachSubscriptionPackageFrequency;
  price: number;
  features: string[];
  maxStudents?: number | null;
  maxSessions?: number | null;
  isActive: boolean;
}

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

export interface CoachUserRef {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  photoUrl?: string;
}

export interface Coach {
  _id?: string;
  id: string;
  userId: string | CoachUserRef;
  photoUrl?: string;
  profileImage?: string;
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
  onboardingProgressStep?: 1 | 2 | 3;
  activeSubscriptionId?: string | null;
  subscriptionStatus?: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  subscriptionExpiresAt?: string | null;
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
  imageKeys?: string[]; // S3 keys for venue images (legacy, regenerate URLs as needed)
  generalImages?: string[];
  generalImageKeys?: string[];
  sportImages?: Record<string, string[]>;
  sportImageKeys?: Record<string, string[]>;
  coverPhotoUrl?: string;
  coverPhotoKey?: string; // S3 key for cover photo (regenerate URL as needed)
  allowExternalCoaches: boolean;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BOOKING TYPES
// ============================================
export type BookingType = "INDIVIDUAL" | "GROUP";
export type PaymentType = "SINGLE" | "SPLIT";
export type SplitMethod = "EQUAL" | "CUSTOM";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";

export interface BookingPayment {
  userId: string;
  userType: "VenueLister" | "Coach" | "Player";
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt?: string;
}

export interface BookingParticipant {
  userId: string;
  name: string;
  status: ParticipantStatus;
  invitedAt: string;
  respondedAt?: string;
}

export interface Booking {
  id: string;
  userId: string | User;
  venueId?: string | Venue; // Can be populated
  venue?: Venue; // Populated venue data
  coachId?: string | Coach; // Can be populated
  coach?: Coach; // Populated coach data
  sport: string; // Required in backend
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  serviceFee?: number;
  taxAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  payments?: Array<{
    userId: string;
    userType: PaymentUserType;
    amount: number;
    status: PaymentStatus;
    paidAt?: string;
  }>;
  status: BookingStatus;
  expiresAt?: string; // Optional - only set for PENDING_PAYMENT bookings
  checkInCode?: string;
  participantName?: string;
  participantId?: string;
  participantAge?: number;
  // Group booking fields - all have defaults so always present
  bookingType: BookingType; // Default: "INDIVIDUAL"
  organizerId: string; // Required (userId for single bookings)
  participants?: BookingParticipant[];
  paymentType: PaymentType; // Default: "SINGLE"
  splitMethod?: SplitMethod;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PAYOUT METHOD TYPES
// ============================================

/** Type of payout method */
export type PayoutMethodType = "BANK_TRANSFER" | "UPI";

/** Payout method configuration for coaches and venue listers */
export interface IPayoutMethod {
  /** MongoDB ObjectId string for individual payout method */
  id?: string;

  /** Type of payout method (bank transfer or UPI) */
  type: PayoutMethodType;

  // ── Bank Transfer Fields ──────────────────────────────
  /** Name of account holder as per bank records (required for BANK_TRANSFER) */
  accountHolderName?: string;

  /** Bank account number (9-18 digits, required for BANK_TRANSFER) */
  accountNumber?: string;

  /** IFSC code in format: 4 letters + 0 + 6 alphanumeric (required for BANK_TRANSFER) */
  ifscCode?: string;

  /** Name of the bank (required for BANK_TRANSFER) */
  bankName?: string;

  // ── UPI Fields ────────────────────────────────────────
  /** UPI ID in format: name@bankname (required for UPI) */
  upiId?: string;

  /** Whether this is the primary/default method for payouts */
  isDefault?: boolean;

  // ── Metadata ──────────────────────────────────────────
  /** ISO timestamp when payout method was first added */
  addedAt?: string;

  /** ISO timestamp of the last update */
  updatedAt?: string;
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
  alternateSlots?: string[];
  allSlots?: string[];
}

export interface DiscoveryResponse {
  venues?: Venue[];
  coaches?: Coach[];
}

export interface ReviewUser {
  _id?: string;
  id?: string;
  name: string;
  photoUrl?: string;
}

export interface ReviewItem {
  _id?: string;
  id?: string;
  bookingId: string;
  userId: string | ReviewUser;
  targetType: "VENUE" | "Coach";
  targetId: string;
  rating: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
}

export interface ReviewListData {
  reviews: ReviewItem[];
  summary: ReviewSummary;
}

// Matches backend BookingService.ts InitiateBookingResponse
export interface InitiateBookingResponse {
  booking: Booking;
}

// ============================================
// SCHEDULE & CALENDAR TYPES
// ============================================

export interface IBlockedDate {
  id?: string;
  _id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  allDay: boolean;
  blockedAt: string;
}

export interface CoachCalendarData {
  bookings: Booking[];
  blockedDates: IBlockedDate[];
  availability: IAvailability[];
  availabilityBySport: Record<string, IAvailability[]>;
  travelBufferTime: number;
}

// ============================================
// CRM & ANALYTICS TYPES
// ============================================

export type NoteType = "GENERAL" | "SESSION" | "INJURY" | "GOAL" | "PROGRESS";

export interface ClientNote {
  _id?: string;
  id?: string;
  coachId: string;
  clientId: string;
  note: string;
  noteType: NoteType;
  sessionDate?: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSummary {
  clientId: string;
  name: string;
  email: string;
  photoUrl?: string;
  sports: string[];
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  isActive: boolean;
}

export interface ClientDetails extends ClientSummary {
  bookings: Booking[];
  notes: ClientNote[];
}

export interface MonthlyEarning {
  label: string;
  total: number;
  sessions: number;
}

export interface SportEarning {
  sport: string;
  total: number;
  sessions: number;
}

export interface EarningsData {
  allTime: { total: number; sessions: number };
  thisMonth: { total: number; sessions: number };
  lastMonth: { total: number; sessions: number };
  pending: { total: number; sessions: number };
  byMonth: MonthlyEarning[];
  bySport: SportEarning[];
  recentBookings: Booking[];
}

export interface AnalyticsOverview {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  totalClients: number;
  returningClients: number;
  retentionRate: number;
  avgRating: number;
  reviewCount: number;
}

export interface TrendPoint {
  label: string;
  count: number;
}

export interface SportBreakdown {
  sport: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  sessionsTrend: TrendPoint[];
  sportBreakdown: SportBreakdown[];
  popularHours: Array<{ hour: number; count: number }>;
  clientRetention: { newClients: number; returningClients: number };
}
