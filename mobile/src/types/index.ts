// User and UserRole come from packages/shared-types; the rest are the app's API envelopes.

import type { User, UserRole } from "@powermysport/shared-types";

export type { User, UserRole };

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
    /** Set when this sign-in cancelled an account deletion that was pending. */
    deletionCancelled?: boolean;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  whatsappConsent: boolean;
}
