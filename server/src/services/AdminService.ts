import Admin, { IAdmin } from "../models/Admin";
import {
  ADMIN_ROLES,
  getRolePermissions,
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
} from "../constants/adminPermissions";
import {
  normalizePermissions,
  areValidPermissions,
} from "../utils/permissions";
import { sendAdminTemporaryCredentialsEmail } from "../utils/email";
import { generateToken } from "../utils/jwt";
import { randomInt } from "crypto";
import { AdminRole } from "../types";

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

  // Find admin with password field
  const admin = await Admin.findOne({ email, isActive: true }).select(
    "+password",
  );

  if (!admin) {
    throw new Error("Invalid credentials");
  }

  // Check password
  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  // Update last login
  admin.lastLogin = new Date();
  await admin.save();

  // Generate token
  const token = generateToken({
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role as AdminRole,
  });

  // Return admin without password
  const adminObject: any = admin.toObject();
  delete adminObject.password;

  return {
    admin: adminObject,
    token,
  };
};

export const createAdmin = async (
  data: CreateAdminPayload,
): Promise<IAdmin> => {
  // Check if admin already exists
  const existingAdmin = await Admin.findOne({ email: data.email });
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
  const admin = new Admin({
    name: data.name,
    email: data.email,
    role,
    permissions,
    password: temporaryPassword,
    mustChangePassword: true,
  });

  await admin.save();

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
    await Admin.findByIdAndDelete(admin._id);
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
): Promise<IAdmin> => {
  const { adminId, currentPassword, newPassword } = payload;

  const admin = await Admin.findById(adminId).select("+password");
  if (!admin || !admin.isActive) {
    throw new Error("Admin not found");
  }

  const isPasswordValid = await admin.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  admin.password = newPassword;
  admin.mustChangePassword = false;
  await admin.save();

  return admin;
};

export const getAdminById = async (adminId: string): Promise<IAdmin | null> => {
  return await Admin.findById(adminId);
};

export const getAllAdmins = async (): Promise<IAdmin[]> => {
  return await Admin.find({ isActive: true });
};

export const updateAdmin = async (
  adminId: string,
  updates: Partial<IAdmin>,
): Promise<IAdmin | null> => {
  // Don't allow password updates through this method
  delete updates.password;

  return await Admin.findByIdAndUpdate(adminId, updates, {
    new: true,
    runValidators: true,
  });
};

export const deactivateAdmin = async (adminId: string): Promise<void> => {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new Error("Admin not found");
  }

  admin.isActive = false;
  await admin.save();
};

/**
 * Update admin permissions
 */
export const updateAdminPermissions = async (
  adminId: string,
  permissions: string[],
): Promise<IAdmin> => {
  // Validate permissions
  if (!areValidPermissions(permissions, ALL_PERMISSIONS)) {
    throw new Error("Invalid permissions provided");
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new Error("Admin not found");
  }

  admin.permissions = normalizePermissions(permissions);
  await admin.save();

  return admin;
};

/**
 * Update admin role and reset permissions to role template
 */
export const updateAdminRole = async (
  adminId: string,
  role: string,
): Promise<IAdmin> => {
  // Validate role
  const validRoles = Object.values(ADMIN_ROLES);
  if (!validRoles.includes(role as any)) {
    throw new Error("Invalid role provided");
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new Error("Admin not found");
  }

  admin.role = role;
  admin.permissions = [...getRolePermissions(role)];
  await admin.save();

  return admin;
};

/**
 * Get all available role templates
 */
export const getRoleTemplatesData = () => {
  return Object.values(ROLE_TEMPLATES);
};
