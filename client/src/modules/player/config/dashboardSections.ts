/**
 * What the dashboard shows, and in what order, per audience.
 *
 * The ordering principle is urgency → people → progress → belonging →
 * shortcuts: what needs the user today, then who they are responsible for,
 * then how those people are progressing, then everyone else, then links.
 *
 * Keeping the order as data rather than as JSX is what keeps role differences
 * out of the components. A section that an audience should not see is *absent
 * from its list*, so the component never mounts and never fetches — which
 * matters beyond tidiness: several of these endpoints are role-gated, and the
 * axios interceptor answers a 401 by throwing the user out to /login. Hiding a
 * card with CSS or an early `return null` would still fire its request.
 */

export type DashboardAudience = "parent" | "player";

export type DashboardSectionId =
  "actions" | "family" | "self" | "journey" | "friends" | "community" | "quickActions";

export const DASHBOARD_SECTIONS: Record<DashboardAudience, readonly DashboardSectionId[]> = {
  // A parent's own profile is reachable from the header; the children are the
  // reason they opened the page, so the roster takes the hero slot.
  parent: ["actions", "family", "journey", "friends", "community", "quickActions"],
  // A player has no children to oversee — their own profile takes that slot.
  player: ["actions", "self", "journey", "friends", "community", "quickActions"],
} as const;
