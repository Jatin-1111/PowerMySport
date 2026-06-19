import jwt from "jsonwebtoken";
import { IUserPayload } from "../types";

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

export const generateToken = (payload: IUserPayload): string => {
  return jwt.sign(payload, RESOLVED_JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

export const verifyToken = (token: string): IUserPayload => {
  try {
    return jwt.verify(token, RESOLVED_JWT_SECRET) as IUserPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
