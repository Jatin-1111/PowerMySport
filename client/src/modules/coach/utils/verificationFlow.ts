import { getCoachVerificationStatus } from "@/modules/coach/utils/verification";
import {
  getDefaultOpeningHours,
  OpeningHours,
} from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { Coach, CoachVerificationDocument, ServiceMode } from "@/types";

/**
 * Pure helpers and draft-persistence for the coach verification flow —
 * extracted from `app/(booking)/coach/verification/page.tsx`, which had
 * grown to 2,062 lines. Nothing here changed behavior, only location.
 */

export type VerificationStep = 1 | 2 | 3;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ALLOWED_IMAGE_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COACH_VERIFICATION_DRAFT_STORAGE_KEY = "coachVerificationDraft:v1";

export const getInitialServiceMode = (): ServiceMode => {
  if (typeof window === "undefined") {
    return "FREELANCE";
  }

  const savedMode = localStorage.getItem("coachServiceMode");
  if (savedMode === "OWN_VENUE" || savedMode === "FREELANCE" || savedMode === "HYBRID") {
    return savedMode;
  }

  return "FREELANCE";
};

export const isValidMobileNumber = (value: string) => /^[+]?[0-9\s().\-]+$/.test(value.trim());

export const sanitizeMobileNumber = (value: string) => value.replace(/[^0-9+\s().\-]/g, "");

// Helper to parse simple opening hours string to structured format
export const parseOpeningHoursString = (hoursStr: string): OpeningHours => {
  // If it's a simple format like "09:00-18:00", apply to all days
  const simplePattern = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/;
  const match = hoursStr.match(simplePattern);

  if (match) {
    const [, openTime, closeTime] = match;
    const dayHours = { isOpen: true, openTime, closeTime };
    return {
      monday: dayHours,
      tuesday: dayHours,
      wednesday: dayHours,
      thursday: dayHours,
      friday: dayHours,
      saturday: dayHours,
      sunday: dayHours,
    };
  }

  // Otherwise return default
  return getDefaultOpeningHours();
};

// Helper to convert OpeningHours to a summary string
export const formatOpeningHoursToString = (hours: OpeningHours): string => {
  const openDays = Object.entries(hours).filter(([, day]) => day.isOpen);

  if (openDays.length === 0) {
    return "Closed";
  }

  // Check if all open days have the same hours
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

  // Return detailed format
  return openDays.map(([day, hours]) => `${day}: ${hours.openTime}-${hours.closeTime}`).join("; ");
};

export interface CoachVerificationDraft {
  step: VerificationStep;
  bio: string;
  mobileNumber: string;
  hourlyRateInput: string;
  pricingMode: "SAME" | "PER_SPORT";
  selectedSports: string[];
  sportPricing: Record<string, string>;
  serviceMode: ServiceMode;
  serviceRadiusKmInput: string;
  travelBufferTimeInput: string;
  venueDetails: {
    name: string;
    address: string;
    description: string;
    openingHours: OpeningHours;
    images: string[];
    imageS3Keys: string[];
  };
  venueCoordinates: [number, number] | null;
  verificationDocs: CoachVerificationDocument[];
  updatedAt: string;
}

export const getCoachVerificationDraftStorageKey = (userId?: string) =>
  userId ? `${COACH_VERIFICATION_DRAFT_STORAGE_KEY}:${userId}` : null;

export const readCoachVerificationDraft = (storageKey: string): CoachVerificationDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CoachVerificationDraft;
  } catch {
    return null;
  }
};

export const writeCoachVerificationDraft = (storageKey: string, draft: CoachVerificationDraft) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(draft));
};

export const clearCoachVerificationDraft = (storageKey: string | null) => {
  if (typeof window === "undefined" || !storageKey) {
    return;
  }

  localStorage.removeItem(storageKey);
};

export const getVerificationBadge = (coachData: Coach | null) => {
  if (!coachData) {
    return {
      label: "Not Started",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
    };
  }

  const status = getCoachVerificationStatus(coachData);

  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      };
    case "PENDING":
      return {
        label: "Pending Review",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    case "REVIEW":
      return {
        label: "In Review",
        className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border border-red-200",
      };
    default:
      return {
        label: "Not Started",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
};

export const getStatusGuidance = (status: string, isDataComplete: boolean) => {
  // Legacy coaches can carry a VERIFIED status while their bio/sports are
  // missing (historic data loss). They keep their verified badge — they just
  // need the required details back before the dashboard unlocks.
  if (status === "VERIFIED" && !isDataComplete) {
    return "Your account is verified, but required profile details are missing. Complete Steps 1 and 2 to restore your listing — no re-review needed.";
  }

  switch (status) {
    case "PENDING":
      return "Your verification is submitted and pending review. You'll be notified once reviewed.";
    case "REVIEW":
      return "Your verification is currently under review. Edits are temporarily disabled.";
    case "VERIFIED":
      return "You are verified! Redirecting to your profile...";
    case "REJECTED":
      return "Your verification was rejected. Update required details and resubmit.";
    default:
      return "Complete all 3 steps: Profile info, Sports & Pricing, and final submission. Documents are optional.";
  }
};

export const validateVerificationFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Upload JPG, PNG, WebP, or PDF only.",
    };
  }

  return { valid: true };
};
