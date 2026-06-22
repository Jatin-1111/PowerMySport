// ─── Shared types mirrored from client/src/types/index.ts ────────────────────

export type UserRole = 'PLAYER' | 'COACH' | 'VENUE_LISTER' | 'ACADEMY_OWNER';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  phone?: string;
  createdAt?: string;
}

export interface IPlayerProfile {
  _id: string;
  user: User;
  age?: number;
  sports?: string[];
  location?: string;
  bio?: string;
}

export interface IGeoLocation {
  type: 'Point';
  coordinates: [number, number];
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface IAvailability {
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Coach {
  _id: string;
  user: User;
  sports: string[];
  bio?: string;
  experience?: number;
  hourlyRate?: number;
  location?: IGeoLocation;
  rating?: number;
  totalReviews?: number;
  isVerified?: boolean;
  profileImage?: string;
  certifications?: string[];
  availability?: IAvailability[];
  distance?: number;
}

export interface Venue {
  _id: string;
  name: string;
  description?: string;
  sports: string[];
  images?: string[];
  location?: IGeoLocation;
  hourlyRate?: number;
  rating?: number;
  totalReviews?: number;
  amenities?: string[];
  capacity?: number;
  owner?: User;
  distance?: number;
}

export interface Academy {
  _id: string;
  name: string;
  description?: string;
  sports: string[];
  images?: string[];
  location?: IGeoLocation;
  coaches?: Coach[];
  ageGroups?: string[];
  monthlyFee?: number;
  rating?: number;
  totalReviews?: number;
}

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type BookingType = 'COACH' | 'VENUE' | 'GROUP';

export interface Booking {
  _id: string;
  type: BookingType;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  date: string;
  totalAmount: number;
  coach?: Coach;
  venue?: Venue;
  player?: User;
  sport?: string;
  notes?: string;
  createdAt: string;
}

export interface ReviewItem {
  _id: string;
  rating: number;
  comment: string;
  reviewer: User;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}

export interface DiscoveryFilters {
  sport?: string;
  city?: string;
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
  search?: string;
}
