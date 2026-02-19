import { Coach } from "@/types";

const COMPLETED_STATUSES = new Set(["PENDING", "REVIEW", "VERIFIED"]);

export const isCoachVerificationFlowComplete = (
  coach: Coach | null | undefined,
): boolean => {
  if (!coach) {
    return false;
  }

  const status =
    coach.verificationStatus || (coach.isVerified ? "VERIFIED" : "UNVERIFIED");
  const hasBio = Boolean(coach.bio?.trim());
  const hasSports = Array.isArray(coach.sports) && coach.sports.length > 0;
  const hasDocs =
    Array.isArray(coach.verificationDocuments) &&
    coach.verificationDocuments.length > 0;

  return COMPLETED_STATUSES.has(status) && hasBio && hasSports && hasDocs;
};
