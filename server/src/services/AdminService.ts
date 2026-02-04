import Admin, { IAdmin } from "../models/Admin";
import { generateToken } from "../utils/jwt";

interface LoginPayload {
  email: string;
  password: string;
}

interface CreateAdminPayload {
  name: string;
  email: string;
  password: string;
  role?: "SUPER_ADMIN" | "ADMIN";
  permissions?: string[];
}

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
    role: "ADMIN", // For compatibility with existing middleware
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

  const admin = new Admin(data);
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
