import type { StatusTone } from "@/modules/shared/ui/StatusTag";
import type { Coach, ServiceMode } from "@/types";
import { getCoachVerificationStatus } from "./verification";

export {
  bookingMoment,
  clockLabel,
  dayLabel,
  selectRequests,
  selectUpcoming,
  timeRange,
  whenLabel,
} from "@/modules/shared/utils/bookingTime";

export interface VerificationView {
  tone: StatusTone;
  tag: string;
}

/**
 * The coach console is open to anyone who has finished the verification form
 * (the layout sends everyone else to /coach/verification), so only these two
 * states reach the overview.
 */
export const verificationView = (coach: Coach): VerificationView =>
  getCoachVerificationStatus(coach) === "VERIFIED"
    ? { tone: "live", tag: "Verified" }
    : { tone: "pending", tag: "In review" };

const SERVICE_MODE_LABEL: Record<ServiceMode, string> = {
  OWN_VENUE: "At your own venue",
  FREELANCE: "Travelling to clients",
  HYBRID: "Own venue and travelling",
};

export const serviceModeLabel = (mode: ServiceMode | undefined): string =>
  (mode && SERVICE_MODE_LABEL[mode]) || "Not set";

/** How many different days of the week the coach has opened. */
export const availableDays = (coach: Coach): number =>
  new Set((coach.availability ?? []).map((slot) => slot.dayOfWeek)).size;
