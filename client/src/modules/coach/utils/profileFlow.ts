import { Coach, IAvailability } from "@/types";
import { AlertCircle, CheckCircle } from "lucide-react";

/**
 * Pure helpers for the coach profile page — extracted from
 * `app/(booking)/coach/profile/page.tsx`, which had grown to 1,998 lines.
 * Nothing here changed behavior, only location.
 *
 * Named distinctly from `verificationFlow.ts`'s `getVerificationBadge` /
 * `getStatusGuidance` — this page derives status differently (reads
 * `verificationStatus`/`isVerified` directly rather than going through
 * `getCoachVerificationStatus`) and returns an icon too, so they are not
 * the same function despite the similar name.
 */

export const MAX_VENUE_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_VENUE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Kept identical to the GST_REGEX enforced server-side (ExpertsService.ts /
// Coach model) so a value valid here stays valid there.
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const sortAvailabilitySlots = (slots: IAvailability[]) =>
  [...slots].sort((first, second) => {
    if (first.dayOfWeek !== second.dayOfWeek) {
      return first.dayOfWeek - second.dayOfWeek;
    }
    if (first.startTime !== second.startTime) {
      return first.startTime.localeCompare(second.startTime);
    }
    return first.endTime.localeCompare(second.endTime);
  });

export const normalizeSports = (sports: string[]) =>
  [...new Set(sports.map((sport) => sport.trim()).filter(Boolean))].sort();

export const normalizeAvailabilityBySport = (bySport: Record<string, IAvailability[]>) => {
  const normalized: Record<string, IAvailability[]> = {};

  Object.entries(bySport).forEach(([sport, slots]) => {
    normalized[sport] = sortAvailabilitySlots(slots).map((slot) => ({
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  });

  return normalized;
};

export const isSameAvailabilityBySport = (
  first: Record<string, IAvailability[]>,
  second: Record<string, IAvailability[]>
) =>
  JSON.stringify(normalizeAvailabilityBySport(first)) ===
  JSON.stringify(normalizeAvailabilityBySport(second));

export const validateAvailabilityBySport = (bySport: Record<string, IAvailability[]>) => {
  for (const [sport, slots] of Object.entries(bySport)) {
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        return `Each time slot in ${sport} must include start and end time.`;
      }
      if (slot.startTime >= slot.endTime) {
        return `End time must be later than start time in ${sport}.`;
      }
    }
  }
  return "";
};

export const getCoachProfileBadge = (coachData: Coach | null) => {
  if (!coachData) {
    return {
      label: "Not Started",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
      icon: AlertCircle,
    };
  }

  const status = coachData.verificationStatus || (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");

  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        icon: CheckCircle,
      };
    case "PENDING":
      return {
        label: "Pending Review",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
        icon: AlertCircle,
      };
    case "REVIEW":
      return {
        label: "In Review",
        className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
        icon: AlertCircle,
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border border-red-200",
        icon: AlertCircle,
      };
    default:
      return {
        label: "Not Started",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
        icon: AlertCircle,
      };
  }
};

export const getCoachProfileStatusGuidance = (status: string) => {
  switch (status) {
    case "PENDING":
      return "Your verification is submitted and pending review. You'll be notified once reviewed.";
    case "REVIEW":
      return "Your verification is currently under review. Edits are temporarily disabled.";
    case "VERIFIED":
      return "You are verified and your profile is visible to players.";
    case "REJECTED":
      return "Your verification was rejected. Update your profile details here and submit required verification updates when prompted.";
    default:
      return "Get started with our 3-step verification process to become a verified coach.";
  }
};
