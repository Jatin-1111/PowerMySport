import { UserRole } from "@/types";

/**
 * The single source of truth for who may be where, and where people land.
 *
 * Before this file, those facts were spread across 45 files and 108 navigation
 * call sites, and the role-to-landing map existed twice with the two copies
 * disagreeing about where a Coach goes after login. There was no place to read
 * to answer "who can reach /coach/earnings".
 *
 * Everything here is a pure function of (pathname, session). That is deliberate:
 * the same decision has to be made in two places eventually — in a client guard
 * today, and in `src/proxy.ts` once the session is readable on the server — and a
 * decision that depends on React state cannot be reused by the proxy. Keep it
 * pure and the enforcement point becomes a deployment detail rather than a
 * rewrite.
 */

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Three states, not two. `unknown` is the one that used to be missing: guards
 * read a null user and could not tell "still loading" from "signed out", so
 * they did nothing and served protected pages to anonymous visitors.
 */
export type SessionState =
  { status: "unknown" } | { status: "anonymous" } | { status: "authenticated"; role: UserRole };

// ─── Console policies ─────────────────────────────────────────────────────────

export type ConsolePolicy = {
  /** URL prefix this policy governs. */
  prefix: string;
  /** Roles permitted anywhere under `prefix`. */
  roles: readonly UserRole[];
  /**
   * Paths under `prefix` that are genuinely public — a setup flow that runs
   * before the account exists. Matched as prefixes.
   */
  publicPaths?: readonly string[];
  /** Where a signed-in user of the wrong role is sent. */
  deniedRedirect?: string;
  /** Message shown to a signed-in user of the wrong role. */
  deniedMessage?: string;
};

/**
 * Ordered most-specific-first. `policyForPath` takes the longest matching
 * prefix, so `/expert/onboarding` can be governed differently from `/expert`
 * without depending on declaration order.
 */
export const CONSOLE_POLICIES: readonly ConsolePolicy[] = [
  {
    prefix: "/dashboard",
    roles: ["Player", "Parent"],
  },
  {
    prefix: "/coach",
    roles: ["Coach"],
  },
  {
    prefix: "/venue-lister",
    roles: ["VenueLister"],
    deniedMessage:
      "The venue console is limited to venue listers. Coaches who want to list a venue need separate venue-lister credentials.",
  },
  {
    prefix: "/academy",
    roles: ["Academy"],
    // Pre-account setup flow: it reads no session of its own, and gating it
    // would break academy signup.
    publicPaths: ["/academy/onboarding"],
    deniedMessage: "Academy dashboard is limited to academy owners.",
  },
  {
    prefix: "/expert",
    roles: ["EXPERT"],
  },
] as const;

/** The policy governing `pathname`, or null if it is not a protected console. */
export const policyForPath = (pathname: string): ConsolePolicy | null => {
  let match: ConsolePolicy | null = null;

  for (const policy of CONSOLE_POLICIES) {
    const isUnderPrefix = pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`);
    if (!isUnderPrefix) continue;
    if (!match || policy.prefix.length > match.prefix.length) {
      match = policy;
    }
  }

  return match;
};

// ─── Access decisions ─────────────────────────────────────────────────────────

export type AccessDecision =
  /** Render the route. */
  | { kind: "allow" }
  /** Session not resolved yet — render nothing and do not navigate. */
  | { kind: "wait" }
  /** Send them away. `preserveReturnPath` marks the sign-in case. */
  | {
      kind: "redirect";
      to: string;
      message?: string;
      preserveReturnPath: boolean;
    };

/**
 * Whether `session` may view `pathname`.
 *
 * Pure and total: every combination of route and session state resolves to
 * exactly one decision, which is what makes the access matrix testable as a
 * table rather than by clicking through the app.
 */
export const resolveAccess = (pathname: string, session: SessionState): AccessDecision => {
  const policy = policyForPath(pathname);

  // Not a protected console.
  if (!policy) return { kind: "allow" };

  const isPublicPath = (policy.publicPaths ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isPublicPath) return { kind: "allow" };

  if (session.status === "unknown") return { kind: "wait" };

  if (session.status === "anonymous") {
    return { kind: "redirect", to: "/login", preserveReturnPath: true };
  }

  if (!policy.roles.includes(session.role)) {
    return {
      kind: "redirect",
      to: policy.deniedRedirect ?? "/",
      message: policy.deniedMessage,
      preserveReturnPath: false,
    };
  }

  return { kind: "allow" };
};

// ─── Landing destinations ─────────────────────────────────────────────────────

/**
 * Three maps, because there are genuinely three questions — the old bug was not
 * that they differed but that they differed *silently*, in copies that drifted.
 * Each difference below is intentional and commented.
 */

/** The console home. Backs the "Dashboard" link in the global nav. */
const CONSOLE_HOME: Record<UserRole, string> = {
  Player: "/dashboard",
  Parent: "/dashboard",
  VenueLister: "/venue-lister/inventory",
  Coach: "/coach/profile",
  Academy: "/academy",
  EXPERT: "/expert/dashboard",
  Admin: "/admin/users",
  // Mid-onboarding venue listers have no console yet — send them back to
  // finish the flow rather than into an inventory view with nothing in it.
  VENUE_ONBOARDING: "/onboarding",
};

/**
 * Where a successful login lands when no return path was requested.
 *
 * Players and parents go to the marketing home rather than their dashboard —
 * their next step is usually discovery, not administration. Every other role
 * goes straight to its console.
 */
const POST_LOGIN: Partial<Record<UserRole, string>> = {
  Player: "/",
  Parent: "/",
};

/**
 * Where a successful registration lands.
 *
 * Differs from login on purpose: a brand-new account has setup to finish, so
 * new coaches go to verification and new experts to onboarding, rather than to
 * a console that would immediately bounce them there anyway.
 */
const POST_SIGNUP: Partial<Record<UserRole, string>> = {
  Parent: "/assessment",
  Player: "/dashboard/my-bookings",
  Coach: "/coach/verification",
  EXPERT: "/expert/onboarding",
};

const SETTINGS_HOME: Record<UserRole, string> = {
  Player: "/dashboard/settings",
  Parent: "/dashboard/settings",
  VenueLister: "/venue-lister/settings",
  Coach: "/coach/settings",
  Academy: "/academy/settings",
  EXPERT: "/expert/settings",
  Admin: "/admin/settings",
  // No settings page exists mid-onboarding — same destination as CONSOLE_HOME.
  VENUE_ONBOARDING: "/onboarding",
};

const FALLBACK_ROUTE = "/dashboard";

/** The console home for `role`. */
export const consoleHomeFor = (role?: UserRole | null): string =>
  (role && CONSOLE_HOME[role]) || FALLBACK_ROUTE;

/** Where `role` lands after signing in. */
export const postLoginFor = (role?: UserRole | null): string =>
  (role && (POST_LOGIN[role] ?? CONSOLE_HOME[role])) || FALLBACK_ROUTE;

/** Where `role` lands after registering. */
export const postSignupFor = (role?: UserRole | null): string =>
  (role && (POST_SIGNUP[role] ?? CONSOLE_HOME[role])) || FALLBACK_ROUTE;

/** The settings page for `role`. */
export const settingsHomeFor = (role?: UserRole | null): string =>
  (role && SETTINGS_HOME[role]) || SETTINGS_HOME.Player;

// ─── Return paths ─────────────────────────────────────────────────────────────

export { currentReturnPath, isExternalReturnPath, safeReturnPath } from "@/lib/returnPath";

/** A login URL that remembers where the visitor was trying to go. */
export const loginUrlFor = (returnTo: string | null): string =>
  returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : "/login";
