import jwt from "jsonwebtoken";
import crypto from "crypto";
import redis from "../config/redis";
import { IUserPayload } from "../types";

export type DecodedJwtPayload = IUserPayload & {
  jti?: string;
  exp?: number;
  iat?: number;
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is not set. Server cannot start.",
    );
  } else {
    console.warn(
      "WARNING: JWT_SECRET is not set. Using an insecure default. " +
        "Set JWT_SECRET in your .env file.",
    );
  }
}

const RESOLVED_JWT_SECRET = JWT_SECRET || "dev_only_insecure_fallback";
const JWT_EXPIRE = "7d";
const REVOKED_TOKEN_PREFIX = "jwt:revoked:";

export const generateToken = (payload: IUserPayload): string => {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    RESOLVED_JWT_SECRET,
    { expiresIn: JWT_EXPIRE },
  );
};

export const verifyToken = (token: string): DecodedJwtPayload => {
  try {
    return jwt.verify(token, RESOLVED_JWT_SECRET) as DecodedJwtPayload;
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
