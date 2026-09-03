import jwt from "jsonwebtoken";
import crypto from "crypto";
import redis from "../config/redis";
import { IUserPayload } from "../types";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("jwt");

export type DecodedJwtPayload = IUserPayload & {
  jti?: string;
  exp?: number;
  iat?: number;
};

// Require a strong JWT secret in EVERY environment. There is intentionally no
// hardcoded fallback: a known default secret lets anyone forge tokens for any
// user/role on any environment where it is used.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not set. Server cannot start. " +
      "Set a strong (>= 32 char) JWT_SECRET in your environment."
  );
}
if (JWT_SECRET.length < 32) {
  log.warn(
    "WARNING: JWT_SECRET is shorter than 32 characters. Use a longer, " +
      "high-entropy secret in production."
  );
}

const RESOLVED_JWT_SECRET = JWT_SECRET;
const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRE = "7d";
const REVOKED_TOKEN_PREFIX = "jwt:revoked:";

/**
 * `JWT_EXPIRE` in milliseconds, for callers that need it as a number.
 *
 * Exported so the auth cookie's `maxAge` is derived from the token's lifetime
 * rather than being a second, independently-maintained copy of "7 days". If the
 * cookie outlives the token the client believes in a session the API rejects; if
 * it dies first, the client is signed out while holding a valid token — which is
 * exactly the mismatch that kept edge-side auth gating switched off.
 */
export const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const generateToken = (payload: IUserPayload): string => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, RESOLVED_JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
    algorithm: JWT_ALGORITHM,
  });
};

export const verifyToken = (token: string): DecodedJwtPayload => {
  try {
    // Pin the algorithm so an attacker cannot substitute "none" or an
    // asymmetric alg to bypass signature verification (alg-confusion).
    return jwt.verify(token, RESOLVED_JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as DecodedJwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

export const isTokenRevoked = async (jti?: string): Promise<boolean> => {
  if (!jti) {
    return false;
  }

  try {
    const value = await redis.get(`${REVOKED_TOKEN_PREFIX}${jti}`);
    return Boolean(value);
  } catch {
    return false;
  }
};

export const revokeToken = async (token: string): Promise<void> => {
  try {
    const decoded = verifyToken(token);
    if (!decoded.jti || !decoded.exp) {
      return;
    }

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.set(`${REVOKED_TOKEN_PREFIX}${decoded.jti}`, "1", "EX", ttl);
    }
  } catch {
    // Ignore invalid/expired tokens during logout.
  }
};
