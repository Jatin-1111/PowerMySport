import bcrypt from "bcryptjs";
import type { Admin } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  ADMIN_ROLES,
  getRolePermissions,
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
} from "../../constants/adminPermissions";
import {
  normalizePermissions,
  areValidPermissions,
} from "../../utils/permissions";
import { sendAdminTemporaryCredentialsEmail } from "../../utils/email";
import { generateToken } from "../../utils/jwt";
import { randomInt } from "crypto";
import { AdminRole } from "../../types/index";

interface LoginPayload {
  email: string;
  password: string;
}

interface CreateAdminPayload {
  name: string;
  email: string;
  role?: string;
  permissions?: string[];
}

interface ChangeAdminPasswordPayload {
  adminId: string;
  currentPassword: string;
  newPassword: string;
}

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@$!%*?&";

const generateTemporaryPassword = (length: number = 12): string => {
  let password = "";

  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_CHARS[randomInt(0, TEMP_PASSWORD_CHARS.length)];
  }

  return password;
};

// Relocated from the Mongoose model hook/method (see SCHEMA_CHANGES §11):
// bcrypt hashing (pre-save hook) and comparePassword (schema method) now live
// in this service, which owns every Admin write/read.
const BCRYPT_COST = 12;

const hashPassword = async (plainPassword: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return bcrypt.hash(plainPassword, salt);
};

export const comparePassword = async (
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, passwordHash);
};

const normalizeUrl = (value: string): string => value.replace(/\/+$/, "");

const deriveAdminBaseUrlFromFrontend = (frontendUrl: string): string | null => {
  try {
    const valueWithProtocol = frontendUrl.includes("://")
      ? frontendUrl
      : `https://${frontendUrl}`;
    const parsed = new URL(valueWithProtocol);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const adminHostname = hostname.startsWith("admin.")
      ? hostname
      : `admin.${hostname}`;

    const protocol =
      parsed.protocol === "http:" && process.env.NODE_ENV === "production"
        ? "https:"
        : parsed.protocol;

    const hasCustomPort =
      parsed.port && parsed.port !== "80" && parsed.port !== "443";
    const port = hasCustomPort ? `:${parsed.port}` : "";

    return `${protocol}//${adminHostname}${port}`;
  } catch {
    return null;
  }
};

const resolveAdminLoginUrl = (): string => {
  const explicitLoginUrl = process.env.ADMIN_LOGIN_URL?.trim();
  if (explicitLoginUrl) {
    return explicitLoginUrl;
  }

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (frontendUrl) {
    const derivedAdminBaseUrl = deriveAdminBaseUrlFromFrontend(frontendUrl);
    if (derivedAdminBaseUrl) {
      return `${normalizeUrl(derivedAdminBaseUrl)}/admin/login`;
    }
  }

  const adminBaseUrl =
    process.env.ADMIN_URL?.trim() ||
    process.env.ADMIN_FRONTEND_URL?.trim() ||
    process.env.ADMIN_APP_URL?.trim();

  if (adminBaseUrl) {
    const normalized = normalizeUrl(adminBaseUrl);
    return normalized.endsWith("/admin/login")
      ? normalized
      : `${normalized}/admin/login`;
  }

  return "http://localhost:3001/admin/login";
};

export const loginAdmin = async (data: LoginPayload) => {
  const { email, password } = data;

  // Find active admin. The Mongo schema lowercased email on save/query; mirror
  // that here so a mixed-case login still matches the stored (lowercased) value.
  const admin = await prisma.admin.findFirst({
    where: { email: email.toLowerCase(), isActive: true },
  });

  if (!admin) {
    throw new Error("Invalid credentials");
  }

  // Check password
  const isPasswordValid = await comparePassword(password, admin.password);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  // Update last login via a targeted write, not a full-document save — a full
  // save would re-validate every field (including permissions), which would
  // block login entirely for any admin carrying legacy/invalid permission
  // strings, for a change that has nothing to do with permissions.
  const lastLogin = new Date();
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin },
  });

  // Generate token
  const token = generateToken({
    id: admin.id,
    email: admin.email,
    role: admin.role as AdminRole,
  });

  // Return admin without password
  const adminObject: any = { ...admin, lastLogin };
  delete adminObject.password;

  return {
    admin: adminObject,
    token,
  };
};

export const createAdmin = async (
  data: CreateAdminPayload,
): Promise<Admin> => {
  const email = data.email.toLowerCase();

  // Check if admin already exists
  const existingAdmin = await prisma.admin.findUnique({ where: { email } });
  if (existingAdmin) {
    throw new Error("Admin with this email already exists");
  }

  // Validate role
  const validRoles = Object.values(ADMIN_ROLES);
  const role =
    data.role && validRoles.includes(data.role as any)
      ? data.role
      : ADMIN_ROLES.SUPPORT_ADMIN;

  // Determine permissions
  let permissions: string[];
  if (Array.isArray(data.permissions) && data.permissions.length > 0) {
    // Custom permissions provided - validate them
    if (!areValidPermissions(data.permissions, ALL_PERMISSIONS)) {
      throw new Error("Invalid permissions provided");
    }
    permissions = normalizePermissions(data.permissions);
  } else {
    // Use role template permissions
    permissions = [...getRolePermissions(role)];
  }

  const temporaryPassword = generateTemporaryPassword();
  // Relocated pre-save hashing hook: hash before create.
  const hashedPassword = await hashPassword(temporaryPassword);

  const admin = await prisma.admin.create({
    data: {
      name: data.name,
      email,
      role: role as Admin["role"],
      permissions,
      password: hashedPassword,
      mustChangePassword: true,
    },
  });

  try {
    const adminPortalUrl = resolveAdminLoginUrl();
    await sendAdminTemporaryCredentialsEmail({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      temporaryPassword,
      loginUrl: adminPortalUrl,
    });
  } catch (error) {
    await prisma.admin.delete({ where: { id: admin.id } });
    throw new Error(
      error instanceof Error
        ? `Failed to send temporary credentials email: ${error.message}`
        : "Failed to send temporary credentials email",
    );
  }

  return admin;
};

export const changeAdminPassword = async (
  payload: ChangeAdminPasswordPayload,
): Promise<Admin> => {
  const { adminId, currentPassword, newPassword } = payload;

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive) {
    throw new Error("Admin not found");
  }

  const isPasswordValid = await comparePassword(currentPassword, admin.password);
  if (!isPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  // Relocated pre-save hashing hook: hash the new password here explicitly with
  // the same cost factor before the targeted update.
  const hashedPassword = await hashPassword(newPassword);

  const updatedAdmin = await prisma.admin.update({
    where: { id: adminId },
    data: { password: hashedPassword, mustChangePassword: false },
  });

  return updatedAdmin;
};

export const getAdminById = async (adminId: string): Promise<Admin | null> => {
  return await prisma.admin.findUnique({ where: { id: adminId } });
};

export const getAllAdmins = async (): Promise<Admin[]> => {
  return await prisma.admin.findMany({ orderBy: { createdAt: "desc" } });
};

export const updateAdmin = async (
  adminId: string,
  updates: Partial<Admin>,
): Promise<Admin | null> => {
  // Don't allow password updates through this method
  delete updates.password;

  const existing = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!existing) {
    return null;
  }

  return await prisma.admin.update({
    where: { id: adminId },
    // `updates` is an arbitrary Partial<Admin> (mirrors the old
    // findByIdAndUpdate); cast so TS accepts it as AdminUpdateInput.
    data: updates as any,
  });
};

export const setAdminActiveStatus = async (
  adminId: string,
  isActive: boolean,
): Promise<Admin> => {
  const existing = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!existing) {
    throw new Error("Admin not found");
  }

  return await prisma.admin.update({
    where: { id: adminId },
    data: { isActive },
  });
};

/**
 * Update admin permissions
 */
export const updateAdminPermissions = async (
  adminId: string,
  permissions: string[],
): Promise<Admin> => {
  // Validate permissions
  if (!areValidPermissions(permissions, ALL_PERMISSIONS)) {
    throw new Error("Invalid permissions provided");
  }

  const existing = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!existing) {
    throw new Error("Admin not found");
  }

  return await prisma.admin.update({
    where: { id: adminId },
    data: { permissions: normalizePermissions(permissions) },
  });
};

/**
 * Update admin role and reset permissions to role template
 */
export const updateAdminRole = async (
  adminId: string,
  role: string,
): Promise<Admin> => {
  // Validate role
  const validRoles = Object.values(ADMIN_ROLES);
  if (!validRoles.includes(role as any)) {
    throw new Error("Invalid role provided");
  }

  const existing = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!existing) {
    throw new Error("Admin not found");
  }

  return await prisma.admin.update({
    where: { id: adminId },
    data: {
      role: role as Admin["role"],
      permissions: [...getRolePermissions(role)],
    },
  });
};

/**
 * Get all available role templates
 */
export const getRoleTemplatesData = () => {
  return Object.values(ROLE_TEMPLATES);
};
