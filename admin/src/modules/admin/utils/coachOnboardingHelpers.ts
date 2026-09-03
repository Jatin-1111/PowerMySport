import {
  getDefaultOpeningHours,
  OpeningHours,
} from "@/modules/onboarding/components/OpeningHoursInput";
import { Coach, CoachVerificationDocument } from "@/types";

/**
 * Pure helpers and types for the admin coach-onboarding form — extracted
 * from `modules/admin/components/CoachOnboardingForm.tsx`, which had grown
 * to 1,538 lines. Nothing here changed behavior, only location.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type Step = 1 | 2 | 3;
export type PricingMode = "SAME" | "PER_SPORT";

export type UploadedDocument = {
  type: CoachVerificationDocument["type"];
  file: File | null;
  fileName: string;
};

export type UploadedVenueImage = {
  file: File;
  fileName: string;
  previewUrl: string;
};

export type ExistingOwnVenueDetails = {
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  images?: string[];
  imageS3Keys?: string[];
  amenities?: string[];
};

export type CreateCoachResponseData = {
  coach?: {
    ownVenueDetails?: ExistingOwnVenueDetails;
  };
  data?: {
    coach?: {
      ownVenueDetails?: ExistingOwnVenueDetails;
    };
  };
};

export type ApiConflictPayload = {
  message?: string;
  requiresConversion?: boolean;
  requiresSeparateAccount?: boolean;
  existingRole?: string;
  targetRole?: string;
};

export const getApiConflictPayload = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return {} as { status?: number; data?: ApiConflictPayload };
  }

  const maybeError = error as {
    response?: { status?: number; data?: ApiConflictPayload };
  };

  return {
    status: maybeError.response?.status,
    data: maybeError.response?.data,
  };
};

export interface FormErrors {
  [key: string]: string;
}

export const emptyVenueHours = (): OpeningHours => getDefaultOpeningHours();

export const isValidMobileNumber = (value: string) => /^[+]?[0-9\s().\-]+$/.test(value.trim());
export const sanitizeMobileNumber = (value: string) => value.replace(/[^0-9+\s().\-]/g, "");

export const formatOpeningHoursToString = (hours: OpeningHours): string => {
  const openDays = Object.entries(hours).filter(([, day]) => day.isOpen);

  if (openDays.length === 0) {
    return "Closed";
  }

  const firstDay = openDays[0][1];
  const allSame = openDays.every(
    ([, day]) => day.openTime === firstDay.openTime && day.closeTime === firstDay.closeTime
  );

  if (allSame && openDays.length === 7) {
    return `${firstDay.openTime}-${firstDay.closeTime} (All days)`;
  }

  if (allSame) {
    const dayNames = openDays.map(([day]) => day.slice(0, 3)).join(",");
    return `${firstDay.openTime}-${firstDay.closeTime} (${dayNames})`;
  }

  return openDays.map(([day, hours]) => `${day}: ${hours.openTime}-${hours.closeTime}`).join("; ");
};

export const toCoachId = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybePayload = payload as {
    coach?: Partial<Coach>;
    data?: { coach?: Partial<Coach> };
  };

  return (
    maybePayload.coach?.id ||
    maybePayload.coach?._id ||
    maybePayload.data?.coach?.id ||
    maybePayload.data?.coach?._id ||
    ""
  );
};
