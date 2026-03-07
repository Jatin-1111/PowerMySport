import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../models/Admin";
import {
  ADMIN_ROLES,
  SYSTEM_ADMIN_PERMISSIONS,
} from "../constants/adminPermissions";

const createSuperAdmin = async () => {
  try {
    // Connect to database
    const MONGODB_URI =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";

    if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
      console.log("⚠️  Warning: Using default local MongoDB connection");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if system admin already exists
    const existingAdmin = await Admin.findOne({
      role: ADMIN_ROLES.SYSTEM_ADMIN,
    });
    if (existingAdmin) {
      console.log("⚠️  System admin already exists");
      console.log(`Email: ${existingAdmin.email}`);
      process.exit(0);
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const superAdminName = process.env.SUPER_ADMIN_NAME || "System Admin";

    if (!superAdminEmail || !superAdminPassword) {
      console.error(
        "❌ Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD in environment",
      );
      process.exit(1);
    }

    // Create system admin
    const superAdmin = new Admin({
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      role: ADMIN_ROLES.SYSTEM_ADMIN,
      permissions: [...SYSTEM_ADMIN_PERMISSIONS],
      isActive: true,
    });

    await superAdmin.save();

    console.log("\n✅ System Admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📧 Email:    ${superAdminEmail}`);
    console.log("🔑 Password: [from SUPER_ADMIN_PASSWORD]");
    console.log(`👤 Role:     ${ADMIN_ROLES.SYSTEM_ADMIN}`);
    console.log(
      `🔐 Permissions: All (${SYSTEM_ADMIN_PERMISSIONS.length} total)`,
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  IMPORTANT: Change this password after first login!");
    console.log("\n🔗 Login at: http://localhost:3000/admin/login\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
    process.exit(1);
  }
};

createSuperAdmin();
