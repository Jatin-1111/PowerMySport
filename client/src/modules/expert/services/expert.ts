import axiosInstance from "@/lib/api/axios";
import { ApiResponse, PaginationMetadata } from "@/types";

export type ExpertSessionMode = "ONLINE" | "IN_PERSON";

export interface ExpertAvailabilityWindow {
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export type ExpertVerificationStatus = "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";

export interface Expert {
  id: string;
  _id?: string;
  name?: string;
  email?: string;
  bio: string;
  sports: string[];
  expertise: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  sessionDurationMinutes?: number;
  timezone?: string;
  hasAvailability?: boolean;
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  /** Where an IN_PERSON/BOTH-mode session happens — owner/admin-only, never public. */
  inPersonAddress?: string;
  isActive: boolean;
  verificationStatus?: ExpertVerificationStatus;
  rejectionReason?: string;
  rating: number;
  reviewCount: number;
  createdAt?: string;
  // Owner/admin-only (via /experts/me or admin endpoints)
  weeklyAvailability?: ExpertAvailabilityWindow[];
  blackoutDates?: string[];
}

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

export type ExpertSessionStatus =
  "PENDING_PAYMENT" | "PAID" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type ExpertRefundStatus = "NONE" | "REQUIRED" | "MANUAL_DONE";

/** Compact briefing an expert sees for the child a session was booked about. */
export interface ExpertSessionPlayer {
  name: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  sportsFocus?: string[];
  topSportMatch?: { sport: string; fitLabel: string; score: number };
  energyType?: string;
  motorType?: string;
  teamIndividual?: number;
  competitiveResponse?: string;
  focusStyle?: string;
  pressureResponse?: string;
  contactComfort?: string;
  environment?: string;
  ambition?: string;
  budgetRange?: string;
  wizardCompletedAt?: string;
}

export interface ExpertSession {
  id: string;
  _id?: string;
  expertId: string;
  userId: string;
  amount: number;
  status: ExpertSessionStatus;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  scheduledAt?: string;
  durationMinutes?: number;
  mode?: ExpertSessionMode;
  meetingLink?: string;
  /** Only present for IN_PERSON sessions, and only once the client has an active booking. */
  inPersonAddress?: string;
  clientNote?: string;
  cancelledAt?: string;
  cancelledBy?: "CLIENT" | "EXPERT" | "ADMIN" | "SYSTEM";
  cancelReason?: string;
  refundStatus?: ExpertRefundStatus;
  expertAcceptance?: "PENDING" | "ACCEPTED" | "DECLINED";
  expertRespondedAt?: string;
  // Canonical display timezone (the expert's) for scheduledAt.
  expertTimezone?: string;
  reviewed: boolean;
  rating?: number;
  review?: string;
  reviewAnonymous?: boolean;
  reviewedAt?: string;
  expert?: Expert;
  clientName?: string;
  /** Present when the parent picked one of their children when booking. */
  player?: ExpertSessionPlayer;
  createdAt: string;
}

/** Full child profile for the expert's dedicated booking-detail page — everything ExpertSessionPlayer leaves out. */
export interface ExpertSessionPlayerDetail {
  name: string;
  age?: number;
  dob?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus?: string[];
  skillLevel?: string;
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "professional";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  trainingType?: "self" | "club" | "academy" | "private";
  sportsInFamily?: string[];
  peerSports?: string[];
  informalSports?: string[];
  informalReaction?: "kept-asking" | "lost-interest";
  futureFlexibility?: "all-in" | "maybe" | "stay-local";
  currentStandingTier?: number;
  bestResultTier?: number;
  achievementsNote?: string;
  academyName?: string;
  sessionsPerWeek?: number;
  trainingMonths?: number;
  wizardCity?: string;
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string;
}

/** AI-guidance roadmap narrative for the child, if a guidance report was ever generated for them. */
export interface ExpertSessionGuidance {
  profileAnalysis?: string;
  idealCoachingStyle?: string;
  weeklyBlueprint?: {
    trainingHours?: string;
    freePlayHours?: string;
    restDays?: string;
  };
  recommendedSports?: string[];
  mentalSkillsRoadmap?: {
    currentFocus?: string;
    skills?: Array<{ skill?: string; howToDevelop?: string }>;
  };
  talentIdentifiers?: string[];
  multiSportAdvisory?: string;
  goalAssessment?: {
    statedGoal?: string;
    verdict?: "On Track" | "Achievable" | "Ambitious" | "Long-Term";
    rationale?: string;
    benchmark?: string;
  };
  burnoutRisk?: {
    level?: "low" | "medium" | "high";
    message?: string;
    recommendations?: string[];
  };
  createdAt?: string;
}

export interface ExpertSessionPlayerDetailResponse {
  player: ExpertSessionPlayerDetail;
  guidance?: ExpertSessionGuidance;
}

export interface ExpertReview {
  rating: number;
  review?: string;
  reviewerName?: string;
  reviewedAt?: string;
}

interface Paginated<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PaginationMetadata;
}

export const expertApi = {
  listExperts: async (params?: {
    sport?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Expert[]>> => {
    const q = new URLSearchParams();
    if (params?.sport) q.append("sport", params.sport);
    if (params?.search) q.append("search", params.search);
    if (params?.page) q.append("page", String(params.page));
    if (params?.limit) q.append("limit", String(params.limit));
    const res = await axiosInstance.get(`/experts?${q.toString()}`);
    return res.data;
  },

  getExpert: async (expertId: string): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.get(`/experts/${expertId}`);
    return res.data;
  },

  getExpertReviews: async (
    expertId: string,
  ): Promise<ApiResponse<ExpertReview[]>> => {
    const res = await axiosInstance.get(`/experts/${expertId}/reviews`);
    return res.data;
  },

  // Open bookable slots for an expert over an optional date range.
  getAvailability: async (
    expertId: string,
    params?: { from?: string; to?: string },
  ): Promise<ApiResponse<OpenSlot[]>> => {
    const q = new URLSearchParams();
    if (params?.from) q.append("from", params.from);
    if (params?.to) q.append("to", params.to);
    const res = await axiosInstance.get(
      `/experts/${expertId}/availability?${q.toString()}`,
    );
    return res.data;
  },

  // Initiates PhonePe payment for a chosen slot; returns a hosted-checkout URL.
  initiateSession: async (
    expertId: string,
    payload: {
      scheduledAt: string;
      clientNote?: string;
      mode?: ExpertSessionMode;
      playerId?: string;
    },
  ): Promise<ApiResponse<{ sessionId: string; redirectUrl: string }>> => {
    const res = await axiosInstance.post(
      `/experts/${expertId}/sessions`,
      payload,
    );
    return res.data;
  },

  reconcileSession: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/reconcile`,
    );
    return res.data;
  },

  getSession: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.get(`/experts/sessions/${sessionId}`);
    return res.data;
  },

  // Full child profile + AI guidance narrative — expert-only booking-detail page.
  getSessionPlayerDetail: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSessionPlayerDetailResponse>> => {
    const res = await axiosInstance.get(
      `/experts/sessions/${sessionId}/player-detail`,
    );
    return res.data;
  },

  scheduleSession: async (
    sessionId: string,
    payload: { scheduledAt: string; mode?: ExpertSessionMode },
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.patch(
      `/experts/sessions/${sessionId}/schedule`,
      payload,
    );
    return res.data;
  },

  setMeetingLink: async (
    sessionId: string,
    meetingLink: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.patch(
      `/experts/sessions/${sessionId}/meeting-link`,
      { meetingLink },
    );
    return res.data;
  },

  completeSession: async (
    sessionId: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/complete`,
    );
    return res.data;
  },

  // Expert accepts / declines / reschedules the client's booked time.
  respondSession: async (
    sessionId: string,
    payload: {
      action: "ACCEPT" | "DECLINE" | "RESCHEDULE";
      scheduledAt?: string;
      reason?: string;
    },
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/respond`,
      payload,
    );
    return res.data;
  },

  cancelSession: async (
    sessionId: string,
    reason?: string,
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/cancel`,
      { reason },
    );
    return res.data;
  },

  reviewSession: async (
    sessionId: string,
    payload: { rating: number; review?: string; anonymous?: boolean },
  ): Promise<ApiResponse<ExpertSession>> => {
    const res = await axiosInstance.post(
      `/experts/sessions/${sessionId}/review`,
      payload,
    );
    return res.data;
  },

  mySessions: async (): Promise<ApiResponse<ExpertSession[]>> => {
    const res = await axiosInstance.get(`/experts/sessions/mine`);
    return res.data;
  },

  // For the logged-in expert's dashboard.
  expertSessions: async (): Promise<ApiResponse<ExpertSession[]>> => {
    const res = await axiosInstance.get(`/experts/sessions/expert`);
    return res.data;
  },

  // Expert self-service profile (role EXPERT).
  getMyProfile: async (): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.get(`/experts/me`);
    return res.data;
  },

  updateMyProfile: async (
    patch: Partial<
      Pick<
        Expert,
        | "bio"
        | "achievements"
        | "sports"
        | "expertise"
        | "languages"
        | "city"
        | "sessionMode"
        | "sessionFee"
        | "sessionDurationMinutes"
        | "timezone"
        | "photoUrl"
        | "photoKey"
        | "inPersonAddress"
        | "weeklyAvailability"
        | "blackoutDates"
      >
    >,
  ): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.patch(`/experts/me`, patch);
    return res.data;
  },

  submitForReview: async (): Promise<ApiResponse<Expert>> => {
    const res = await axiosInstance.post(`/experts/me/review`);
    return res.data;
  },
};
