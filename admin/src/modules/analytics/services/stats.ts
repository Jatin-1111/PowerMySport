import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Booking, Venue } from "@/types";

export interface PlatformStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  pendingInquiries: number;
  revenue: number;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

export type UsersTabRole = "PLAYER" | "COACH" | "VENUE_LISTER";

export interface UsersRoleSummary {
  PLAYER: number;
  COACH: number;
  VENUE_LISTER: number;
}

export interface PlayerUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "PLAYER";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  sports: string[];
  sportsCount: number;
  hasSportsProfile: boolean;
  dependentsCount: number;
}

export interface CoachUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "COACH";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  sports: string[];
  hourlyRate: number | null;
  serviceMode: "OWN_VENUE" | "FREELANCE" | "HYBRID" | null;
  verificationStatus:
    | "UNVERIFIED"
    | "PENDING"
    | "REVIEW"
    | "VERIFIED"
    | "REJECTED";
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  profileIncomplete: boolean;
}

export interface VenueListerUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "VENUE_LISTER";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  businessName: string;
  canAddMoreVenues: boolean;
  venueCount: number;
  approvedVenueCount: number;
  pendingVenueCount: number;
}

export interface PlayersAnalytics {
  totalPlayers: number;
  newThisMonth: number;
  withSportsProfile: number;
  withDependents: number;
  newAccountsLast24Hours: number;
}

export interface CoachesAnalytics {
  totalCoaches: number;
  verifiedCount: number;
  pendingOrReviewCount: number;
  avgRating: number;
  newAccountsLast24Hours: number;
}

export interface VenueListersAnalytics {
  totalVenueListers: number;
  withAtLeastOneVenue: number;
  approvedVenuesCount: number;
  pendingVenuesCount: number;
  newAccountsLast24Hours: number;
}

export const statsApi = {
  getPlatformStats: async (): Promise<ApiResponse<PlatformStats>> => {
    const response = await axiosInstance.get("/stats/platform");
    return response.data;
  },

  getAllUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<UserData[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users?${params.toString()}`,
    );
    return response.data;
  },

  getUsersRoleSummary: async (): Promise<ApiResponse<UsersRoleSummary>> => {
    const response = await axiosInstance.get("/stats/users/summary");
    return response.data;
  },

  getPlayersUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PlayerUserRow[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users/players?${params.toString()}`,
    );
    return response.data;
  },

  getCoachUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<CoachUserRow[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users/coaches?${params.toString()}`,
    );
    return response.data;
  },

  getVenueListerUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<VenueListerUserRow[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users/venue-listers?${params.toString()}`,
    );
    return response.data;
  },

  getPlayersAnalytics: async (): Promise<ApiResponse<PlayersAnalytics>> => {
    const response = await axiosInstance.get("/stats/users/analytics/players");
    return response.data;
  },

  getCoachesAnalytics: async (): Promise<ApiResponse<CoachesAnalytics>> => {
    const response = await axiosInstance.get("/stats/users/analytics/coaches");
    return response.data;
  },

  getVenueListersAnalytics: async (): Promise<
    ApiResponse<VenueListersAnalytics>
  > => {
    const response = await axiosInstance.get(
      "/stats/users/analytics/venue-listers",
    );
    return response.data;
  },

  getAllVenues: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/venues?${params.toString()}`,
    );
    return response.data;
  },

  getAllBookings: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Booking[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/bookings?${params.toString()}`,
    );
    return response.data;
  },
};
