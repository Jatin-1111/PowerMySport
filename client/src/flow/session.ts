import { jwtVerify } from "jose";
import type { SessionState } from "./policy";
import type { UserRole } from "@/types";

/**
 * Reads the session from the auth cookie, for use in `src/proxy.ts`.
 *
 * Uses `jose`. A Next proxy runs on Node.js, so `jsonwebtoken` would also work —
 * `jose` is kept because it is already the dependency here and works unchanged
 * if any of this is ever reused somewhere without Node built-ins.
 *
 * ── Why this leans towards `unknown` ──────────────────────────────────────────
 *
 * The safest failure mode here is "I cannot tell", not "signed out". A guard
 * that decides "signed out" whenever it fails to read a session will, if the
 * secret is misconfigured, redirect *every* user to the login page — and the
 * login page redirects straight back as soon as it hydrates a user from
 * localStorage, which is an infinite loop that takes the whole app down.
 *
 * So only genuinely conclusive evidence produces `anonymous`. Anything that
 * might be our own misconfiguration produces `unknown`, which `resolveAccess`
 * answers with `wait` — the request passes through and the client-side guard
 * decides. Fail-open here is not laziness: the API is still the enforcement
 * point, so an open proxy costs a redundant render, while a closed one costs an
 * outage.
 */

/** The cookie the API sets on login, register and Google sign-in. */
export const AUTH_COOKIE_NAME = "token";

/**
 * Set `PROXY_BLOCK_ANONYMOUS=true` to have the proxy bounce cookie-less requests
 * to login before the page renders.
 *
 * Default off, deliberately, and it is not safe to flip yet.
 *
 * The API now sets `maxAge` on the auth cookie (derived from `TOKEN_MAX_AGE_MS`)
 * so its lifetime matches the token's. That was the prerequisite, but it only
 * applies to sessions created *after* that change ships.
 *
 * Anyone who signed in before the deploy still holds a 7-day token in
 * localStorage with no persistent cookie. For them, blocking on cookie absence
 * is an infinite loop, not a redirect: the proxy sends them to /login, the login
 * page hydrates a user from localStorage and sends them straight back, and the
 * proxy bounces them again.
 *
 * Safe to enable once every pre-deploy token has expired — i.e. at least 7 days
 * after the cookie `maxAge` change is live in production, since that is the
 * token's own lifetime. Enabling it earlier takes the app down for exactly the
 * users who were already signed in.
 */
const shouldBlockAnonymous = (): boolean => process.env.PROXY_BLOCK_ANONYMOUS === "true";

const KNOWN_ROLES: readonly UserRole[] = [
  "Player",
  "Parent",
  "VenueLister",
  "Coach",
  "Academy",
  "EXPERT",
  "Admin",
];

const isKnownRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (KNOWN_ROLES as readonly string[]).includes(value);

export type ReadSessionOptions = {
  /** Raw cookie value, or null/undefined when absent. */
  token: string | null | undefined;
  /** The signing secret. When absent, the token cannot be verified. */
  secret: string | undefined;
  /** Whether a missing token is conclusive evidence of being signed out. */
  blockAnonymous: boolean;
};

/**
 * Resolve a `SessionState` from a raw token.
 *
 * Pure apart from the crypto, so the mapping from token to session can be
 * tested directly rather than inferred from redirect behaviour.
 */
export const readSession = async ({
  token,
  secret,
  blockAnonymous,
}: ReadSessionOptions): Promise<SessionState> => {
  if (!token) {
    // No cookie. Conclusive only if we trust the cookie to always be there.
    return blockAnonymous ? { status: "anonymous" } : { status: "unknown" };
  }

  if (!secret) {
    // A token we cannot check is not evidence of anything.
    return { status: "unknown" };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      // Pinned so a token claiming "alg": "none" cannot be substituted. Mirrors
      // the API's own pinning in server/src/utils/jwt.ts.
      { algorithms: ["HS256"] }
    );

    if (!isKnownRole(payload.role)) {
      // Signature is good but the payload is not shaped as expected — most
      // likely a version skew. Do not guess at access from it.
      return { status: "unknown" };
    }

    return { status: "authenticated", role: payload.role };
  } catch (error) {
    const code = (error as { code?: string })?.code;

    // Expiry is conclusive: the token is genuinely no longer a session, and the
    // copy in localStorage has the same expiry, so there is nothing to loop
    // back to.
    if (code === "ERR_JWT_EXPIRED") {
      return { status: "anonymous" };
    }

    // Anything else — bad signature, malformed token, wrong secret — is more
    // likely our misconfiguration than the user's fault.
    return { status: "unknown" };
  }
};

/** `readSession` wired to the ambient environment, for the proxy. */
export const readSessionFromCookie = (token: string | null | undefined): Promise<SessionState> =>
  readSession({
    token,
    secret: process.env.JWT_SECRET,
    blockAnonymous: shouldBlockAnonymous(),
  });
