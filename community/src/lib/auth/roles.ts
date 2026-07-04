export const isCommunityEligibleRole = (role?: string): boolean =>
  role === "Player" || role === "Coach";
