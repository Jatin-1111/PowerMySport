import { Request } from "express";
import crypto from "crypto";
import { log as __rootLog } from "../../../utils/logger";

export const log = __rootLog.child("admin");

export const auditContext = (req: Request): { adminId: string; adminEmail: string } | null => {
  if (!req.user?.id || !req.user.email) return null;
  return { adminId: req.user.id, adminEmail: req.user.email };
};

export const normalizeAdminResponse = (admin: unknown) => {
  if (!admin || typeof admin !== "object") {
    return admin;
  }

  const objectValue = admin as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof objectValue.toObject === "function"
      ? objectValue.toObject()
      : (admin as Record<string, unknown>);

  const idSource = plain._id;
  const id =
    typeof plain.id === "string"
      ? plain.id
      : idSource && typeof (idSource as { toString?: () => string }).toString === "function"
        ? (idSource as { toString: () => string }).toString()
        : "";

  return {
    ...plain,
    id,
  };
};

export const generateTempPassword = (length = 12): string => {
  const desiredLength = Math.max(8, length);
  let password = "";

  while (password.length < desiredLength) {
    password += crypto.randomBytes(16).toString("base64url");
    password = password.replace(/[^a-zA-Z0-9]/g, "");
  }

  return password.slice(0, desiredLength);
};

export const buildUserSummary = (user: {
  _id?: { toString?: () => string };
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}) => ({
  id: user._id?.toString?.() || "",
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});
