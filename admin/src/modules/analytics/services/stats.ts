import axiosInstance from "@/lib/api/axios";
import { ApiResponse, Booking, Venue } from "@/types";

export interface PlatformStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  pendingInquiries: number;
  revenue: number;
}

export interface PendingCounts {
  academyOnboarding: number;
  coachVerification: number;
  venueApprovals: number;
  communityReports: number;
  disputes: number;
  supportTickets: number;
  conciergeRequests: number;
  webhookErrors: number;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

export type UsersTabRole = "EXPERT" | "Parent" | "Player" | "Coach" | "VenueLister";

export interface UsersRoleSummary {
  EXPERT: number;
  Parent: number;
  Player: number;
  Coach: number;
  VenueLister: number;
}

export interface ParentUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "Parent";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  dependentsCount: number;
}

export interface ExpertUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "EXPERT";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  specialization?: string;
  sessionCount?: number;
}

export interface PlayerUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "Player";
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
  role: "Coach";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
  sports: string[];
  hourlyRate: number | null;
  serviceMode: "OWN_VENUE" | "FREELANCE" | "HYBRID" | null;
  verificationStatus:
    "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";
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
  role: "VenueLister";
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

export interface FunnelSummaryRow {
  eventName: string;
  count: number;
  uniqueUsers: number;
}

export interface FunnelTrendPoint {
  dateKey: string;
  label: string;
  total: number;
  WEB: number;
  MOBILE: number;
  SERVER: number;
}

export interface FunnelTrendBreakdown {
  source: "WEB" | "MOBILE" | "SERVER";
  count: number;
}

export interface FunnelTrends {
  days: number;
  dailyActivity: FunnelTrendPoint[];
  sourceBreakdown: FunnelTrendBreakdown[];
}

export interface UserGrowthPoint {
  monthKey: string;
  label: string;
  total: number;
  Player: number;
  Coach: number;
  VenueLister: number;
}

export interface UserGrowthAnalytics {
  months: number;
  series: UserGrowthPoint[];
}

export interface FinanceReconciliation {
  totalBookingsChecked: number;
  matched: number;
  mismatched: number;
  mismatchRate: number;
  sampleMismatches: Array<{
    bookingId: string;
    expected: number;
    paid: number;
    status: string;
  }>;
}

export interface ObservabilityRouteMetric {
  routeKey: string;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  lastSeenAt: string;
}

export interface ObservabilitySnapshot {
  totals: {
    requests: number;
    errors: number;
    errorRate: number;
  };
  routes: ObservabilityRouteMetric[];
  generatedAt: string;
}

export interface GuestActivityTotals {
  events: number;
  uniqueGuests: number;
  pageViews: number;
  avgScrollPct: number;
  avgTimeOnPageSec: number;
}

export interface GuestTopPage {
  path: string;
  views: number;
  uniqueGuests: number;
}

export interface GuestTopEvent {
  eventName: string;
  count: number;
  uniqueGuests: number;
}

export interface GuestDailyPoint {
  label: string;
  views: number;
  uniqueGuests: number;
}

export interface GuestActivity {
  days: number;
  totals: GuestActivityTotals;
  topPages: GuestTopPage[];
  topEvents: GuestTopEvent[];
  daily: GuestDailyPoint[];
}

export interface InfraOverview {
  available: boolean;
  error?: string;
  region: string;
  environmentName: string;
  refreshedAt: string;
  environment: {
    status?: string;
    health?: string;
    healthStatus?: string;
    color?: string;
    versionLabel?: string;
    endpointUrl?: string;
    dateUpdated?: string;
    causes: string[];
  } | null;
  application: {
    requestCount: number;
    durationSec: number;
    statusCodes: { p2xx: number; p3xx: number; p4xx: number; p5xx: number };
    latencyMs: { p50: number; p90: number; p99: number };
  } | null;
  instanceCounts: Record<string, number>;
  instances: Array<{
    instanceId: string;
    health?: string;
    color?: string;
    cpuBusyPct: number;
    loadAvg: number[];
    version?: string;
    launchedAt?: string;
    causes: string[];
  }>;
  events: Array<{ date?: string; severity?: string; message?: string }>;
  runtime?: RuntimeStats;
}

export interface RuntimeStats {
  hostname: string;
  uptimeSec: number;
  cpuCount: number;
  loadAvg: number[];
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    usedPct: number;
    processRssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface InfraMetricPoint {
  t: string;
  v: number;
}

export interface InfraMetrics {
  available: boolean;
  error?: string;
  hours: number;
  periodSec: number;
  series: {
    cpuPct: InfraMetricPoint[];
    requestCount: InfraMetricPoint[];
    latencyMs: InfraMetricPoint[];
    errors4xx: InfraMetricPoint[];
    errors5xx: InfraMetricPoint[];
  };
}

export interface UnsupportedSportRow {
  sport: string;
  count: number;
  lastSearched: string;
  sources: string[];
}

export interface UnsupportedSportsStats {
  rows: UnsupportedSportRow[];
  totalSearches: number;
  days: number;
}

export const statsApi = {
  getPlatformStats: async (): Promise<ApiResponse<PlatformStats>> => {
    const response = await axiosInstance.get("/stats/platform");
    return response.data;
  },

  getPendingCounts: async (): Promise<ApiResponse<PendingCounts>> => {
    const response = await axiosInstance.get("/stats/pending-counts");
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

  getUserGrowthAnalytics: async (
    months = 6,
  ): Promise<ApiResponse<UserGrowthAnalytics>> => {
    const response = await axiosInstance.get("/stats/users/growth", {
      params: { months },
    });
    return response.data;
  },

  getExpertUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ExpertUserRow[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users/experts?${params.toString()}`,
    );
    return response.data;
  },

  getParentUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ParentUserRow[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users/parents?${params.toString()}`,
    );
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

  getExpertUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ExpertUserRow[]>> => {
    const params = new URLSearchParams();
    params.append("role", "EXPERT");
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users?${params.toString()}`,
    );
    return response.data;
  },

  getParentUsers: async (pagination?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ParentUserRow[]>> => {
    const params = new URLSearchParams();
    params.append("role", "Parent");
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());

    const response = await axiosInstance.get(
      `/stats/users?${params.toString()}`,
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
    search?: string;
  }): Promise<ApiResponse<Venue[]>> => {
    const params = new URLSearchParams();
    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());
    if (pagination?.search) params.append("search", pagination.search);

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

  getFunnelSummary: async (
    days = 30,
  ): Promise<ApiResponse<{ days: number; events: FunnelSummaryRow[] }>> => {
    const response = await axiosInstance.get(`/stats/funnel/summary`, {
      params: { days },
    });
    return response.data;
  },

  getFunnelTrends: async (days = 30): Promise<ApiResponse<FunnelTrends>> => {
    const response = await axiosInstance.get("/stats/funnel/trends", {
      params: { days },
    });
    return response.data;
  },

  getFinanceReconciliation: async (): Promise<
    ApiResponse<FinanceReconciliation>
  > => {
    const response = await axiosInstance.get("/stats/finance/reconciliation");
    return response.data;
  },

  getObservabilitySnapshot: async (): Promise<
    ApiResponse<ObservabilitySnapshot>
  > => {
    const response = await axiosInstance.get("/stats/observability");
    return response.data;
  },

  getGuestActivity: async (days = 30): Promise<ApiResponse<GuestActivity>> => {
    const response = await axiosInstance.get("/stats/guests/activity", {
      params: { days },
    });
    return response.data;
  },

  // Destructive: permanently deletes every analytics event.
  clearAnalytics: async (): Promise<ApiResponse<{ deletedCount: number }>> => {
    const response = await axiosInstance.delete("/stats/analytics");
    return response.data;
  },

  getInfraOverview: async (): Promise<ApiResponse<InfraOverview>> => {
    const response = await axiosInstance.get("/stats/infra/overview");
    return response.data;
  },

  getInfraMetrics: async (hours = 6): Promise<ApiResponse<InfraMetrics>> => {
    const response = await axiosInstance.get("/stats/infra/metrics", {
      params: { hours },
    });
    return response.data;
  },

  getVenueById: async (venueId: string): Promise<ApiResponse<Venue>> => {
    const response = await axiosInstance.get(`/venues/${venueId}`);
    return response.data;
  },

  getUnsupportedSportsStats: async (
    days = 30,
  ): Promise<ApiResponse<UnsupportedSportsStats>> => {
    const response = await axiosInstance.get("/stats/unsupported-sports", {
      params: { days },
    });
    return response.data;
  },
};
