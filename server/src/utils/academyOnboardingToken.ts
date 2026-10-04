import crypto from "crypto";

/**
 * Capability token for an in-progress academy onboarding.
 *
 * Academies sign up without an account (`/academy/onboarding` is a public
 * path in the client's access policy), so there is no session to authorise the
 * later steps against. `POST /onboarding/start` hands the creator a random
 * token once; only its SHA-256 is stored on the Academy, so a database read
 * does not yield a usable token. Every later call must present it, or be the
 * linked owner account, or an admin.
 */
export const ONBOARDING_TOKEN_HEADER = "x-academy-onboarding-token";

export const issueOnboardingToken = (): { token: string; hash: string } => {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashOnboardingToken(token) };
};

export const hashOnboardingToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/** Constant-time comparison of a presented token against the stored hash. */
export const onboardingTokenMatches = (presented: string, storedHash: string): boolean => {
  const a = Buffer.from(hashOnboardingToken(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
