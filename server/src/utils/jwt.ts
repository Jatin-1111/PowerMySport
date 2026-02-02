import jwt from "jsonwebtoken";
import { IUserPayload } from "../types/index";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
const JWT_EXPIRE = "7d";

export const generateToken = (payload: IUserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

export const verifyToken = (token: string): IUserPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as IUserPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
