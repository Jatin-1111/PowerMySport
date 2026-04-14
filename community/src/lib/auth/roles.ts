export const isCommunityEligibleRole = (role?: string): boolean =>
  role === "PLAYER" || role === "COACH";
