import { Coach } from "@/types";

const COMPLETED_STATUSES = new Set(["PENDING", "REVIEW", "VERIFIED"]);

/**
 * Legacy coach records can be verified without a `verificationStatus` field, so
 * always derive the status through here instead of reading the field directly.
 */
export const getCoachVerificationStatus = (coach: Coach | null | undefined): string => {
  if (!coach) {
    return "UNVERIFIED";
  }

  return coach.verificationStatus || (coach.isVerified ? "VERIFIED" : "UNVERIFIED");
};

export const isCoachVerificationFlowComplete = (coach: Coach | null | undefined): boolean => {
  if (!coach) {
    return false;
  }

  const status = getCoachVerificationStatus(coach);
  const hasBio = Boolean(coach.bio?.trim());
  const hasSports = Array.isArray(coach.sports) && coach.sports.length > 0;

  return COMPLETED_STATUSES.has(status) && hasBio && hasSports;
};
