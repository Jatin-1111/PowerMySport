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

// UserRole, BookingStatus, PaymentUserType, PaymentStatus and
// VenueListerProfile now live in @powermysport/shared-types — this file
// previously had its own independent copy of each, which had drifted from
// both the server model and admin's copy (missing "VENUE_ONBOARDING" on
// UserRole, missing "Expert" on PaymentUserType, and — the reverse direction
// — this file required businessDetails/payoutInfo on VenueListerProfile
// while admin correctly treated them as optional). See that package for the
// merge notes.
import type {
  UserRole,
  BookingStatus,
  PaymentUserType,
  PaymentStatus,
  VenueListerProfile,
} from "@powermysport/shared-types";
export type { UserRole, BookingStatus, PaymentUserType, PaymentStatus, VenueListerProfile };

export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";

export interface IPayment {
  userId: string;
  userType: PaymentUserType;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
}

/**
 * A dependent (child) profile, grouped by what the data actually means rather
 * than which wizard step happened to collect it.
 *
 * This is the CLIENT-FACING shape only. The server stores (and the wire
 * format sends/receives) the same fields flat — see `DependentWire` in
 * `@/modules/player/utils/dependentNormalize`, which also has the
 * `normalizeDependent`/`denormalizeDependent` functions that convert between
 * the two. Every read of a dependent from the API goes through
 * `normalizeDependent` once, at the profile-fetch boundary
 * (`useProfile.ts`); every write goes through `denormalizeDependent`, inside
 * `authApi.addDependent`/`updateDependent`. Nothing else should convert
 * between the two shapes by hand — that duplication (three write flows each
 * building their own payload) is exactly what this redesign replaced.
 */
export interface Dependent {
  _id?: string;
  name: string;
  dob: string; // ISO date string
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  location?: string; // Indian state
  medicalConditions?: string[];

  /** What sport they're on, and how they got there. Every write flow (the
   * Discover wizard, "I already know my sport", the profile modal) must
   * agree on this section — `chosenSport` in particular is the one
   * committed decision, set by EITHER path, not just the wizard. */
  sport?: {
    /** What the parent told us directly (may be more than one). */
    sportsFocus?: string[];
    /** Shortlisted during the assessment (max 3) — a candidate, not a decision. */
    consideringSports?: string[];
    sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
    wizardCompletedAt?: string;
    /** The sport the parent committed to — a decision, not a score. */
    chosenSport?: string;
    chosenSportAt?: string;
  };

  physical?: {
    heightCm?: number;
    weightKg?: number;
    build?: "lean" | "average" | "stocky";
    heightCategory?: "short" | "average" | "tall";
    energyType?: "explosive" | "endurance";
    motorType?: "gross" | "fine";
    visualTracking?: "strong" | "moderate" | "weak";
    eyesight?: "sharp" | "corrected" | "limited";
    agility?: "high" | "moderate" | "low";
  };

  personality?: {
    personalityTags?: string[];
    teamIndividual?: number; // 1-5
    competitiveResponse?: "fired-up" | "calm" | "discouraged";
    focusStyle?: "bursts" | "sustained";
    decisionStyle?: "react" | "strategic";
    pressureResponse?: "thrives" | "manages" | "avoids";
    repetitionTolerance?: "high" | "low";
  };

  comfort?: {
    contactComfort?: "loves" | "neutral" | "avoids";
    environment?: "outdoor" | "indoor" | "no-preference";
    waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  };

  /** Logistics — what it takes to actually do this sport. */
  practical?: {
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
    ambition?: "fun" | "competitive" | "national" | "career" | "professional";
    weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
    trainingType?: "self" | "club" | "academy" | "private";
  };

  /** Where they currently stand in the sport — distinct from "practical"
   * (logistics) and "sport" (which sport / how they found it). */
  standing?: {
    skillLevel?: string;
    yearsPlaying?: number;
    experienceLevel?: "beginner" | "intermediate" | "competitive";
    currentStandingTier?: number; // 1-5
    bestResultTier?: number; // 1-5
    achievementsNote?: string;
  };

  training?: {
    academyName?: string;
    sessionsPerWeek?: number;
    trainingMonths?: number;
    wizardCity?: string;
  };

  pathwayState?: {
    satisfiedPrerequisites?: string[];
    currentGpa?: number;
    targetDivision?: string;
    graduationYear?: number;
  };

  paymentHistory?: Array<{ bookingId: string; amount: number; date: string }>;
}

// UserShippingAddress now lives in @powermysport/shared-types (identical
// field-for-field to this app's previous copy, so this is a pure alias).
export type { UserShippingAddress } from "@powermysport/shared-types";
import type { User as SharedUser } from "@powermysport/shared-types";

/**
 * client's `id`/`dependents`/`playerProfile` were always required/typed here
 * (the shared type keeps `dependents` loose, and its `playerProfile` mirrors
 * the server's simple `{sports}` shape — NOT this app's richer assessment
 * profile, which is a different concept that happens to share a name).
 */
export interface User extends Omit<SharedUser, "id" | "dependents" | "playerProfile"> {
  id: string;
  dependents?: Dependent[];
  playerProfile?: IPlayerProfile;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
    /** True when this login cancelled a pending self-deletion (grace period). */
    deletionCancelled?: boolean;
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

export type CoachSubscriptionPackageFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type CoachSubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

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
  type: "CERTIFICATION" | "ID_PROOF" | "ADDRESS_PROOF" | "BACKGROUND_CHECK" | "INSURANCE" | "OTHER";
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
  /** GST number — optional; not every individual coach is GST-registered. */
  gstNumber?: string;
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
  /** GST number — optional; not every venue lister is GST-registered. */
  gstNumber?: string;
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
  userType: "VenueLister" | "Coach" | "Academy" | "Player";
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

export interface AcademyRef {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
}

/**
 * The expert fields a booking carries for display. Deliberately narrow: the full
 * Expert profile holds tax identifiers the bookings API does not return.
 */
export interface BookingExpertRef {
  id: string;
  _id?: string;
  name?: string;
  photoUrl?: string;
  city?: string;
  sessionMode?: "ONLINE" | "IN_PERSON" | "BOTH";
  timezone?: string;
  rating?: number;
  reviewCount?: number;
}

/** Which kind of provider a booking is against. */
export type BookingProviderType = "VENUE" | "COACH" | "ACADEMY" | "EXPERT";

// Booking now lives in @powermysport/shared-types. It previously had a
// narrower inline `expert` object here (missing the gateway-id and
// reminder-timestamp fields the server model actually has) and no
// `delivery` field at all — both come along for free below since the
// shared type is a superset; nothing that read fewer fields breaks.
import type { Booking as SharedBooking } from "@powermysport/shared-types";

export interface Booking extends Omit<
  SharedBooking,
  | "userId"
  | "venueId"
  | "coachId"
  | "academyId"
  | "expertId"
  | "bookingType"
  | "organizerId"
  | "paymentType"
  | "createdAt"
  | "updatedAt"
> {
  userId: string | User;
  venueId?: string | Venue; // Can be populated
  venue?: Venue; // Populated venue data
  coachId?: string | Coach; // Can be populated
  coach?: Coach; // Populated coach data
  academyId?: string | AcademyRef; // Can be populated
  /** Set for providerType EXPERT. Populated by the bookings API. */
  expertId?: string | BookingExpertRef;
  sport: string; // Required in backend
  // Group booking fields — all have defaults so always present, unlike the
  // shared type's optional-for-safety versions.
  bookingType: BookingType;
  organizerId: string;
  paymentType: PaymentType;
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
export type { PaginationMetadata, ApiResponse } from "@powermysport/shared-types";

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
