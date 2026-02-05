// ============================================
// ROLE & ENUM TYPES
// ============================================
export type UserRole = "PLAYER" | "VENUE_LISTER" | "COACH" | "ADMIN";
export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";
export type PaymentStatus = "PENDING" | "PAID";
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
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
  serviceRadiusKm?: number; // Required if FREELANCE/HYBRID
  travelBufferTime?: number; // Minutes, required if FREELANCE/HYBRID
  availability: IAvailability[];
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

export interface IVenue {
  id?: string;
  name: string;
  ownerId: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  amenities: string[];
  description: string;
  images: string[];
  allowExternalCoaches: boolean;
  requiresLocationUpdate?: boolean; // Migration flag
  createdAt?: Date;
  updatedAt?: Date;
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
