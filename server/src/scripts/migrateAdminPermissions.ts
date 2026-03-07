import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../models/Admin";
import {
  ADMIN_ROLES,
  SUPPORT_ADMIN_PERMISSIONS,
  SYSTEM_ADMIN_PERMISSIONS,
} from "../constants/adminPermissions";

/**
 * Migration script to update existing admins to new permission system
 *
 * Changes:
 * - SUPER_ADMIN role → SYSTEM_ADMIN role with all permissions
 * - ADMIN role → SUPPORT_ADMIN role with base permissions
 */
const migrateAdminPermissions = async () => {
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

    // Find all admins
    const allAdmins = await Admin.find({});

    if (allAdmins.length === 0) {
      console.log("\n✅ No admins found in the database");
      process.exit(0);
    }

    console.log(`\n🔍 Found ${allAdmins.length} admin(s) to migrate`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let migratedCount = 0;
    let skippedCount = 0;

    for (const admin of allAdmins) {
      const oldRole = admin.role;
      const oldPermissions = [...admin.permissions];

      // Check if admin already uses new role system
      if (Object.values(ADMIN_ROLES).includes(admin.role as any)) {
        console.log(
          `⏭️  Skipped: ${admin.name} (${admin.email}) - Already migrated`,
        );
        skippedCount++;
        continue;
      }

      // Migrate based on old role
      if (oldRole === "SUPER_ADMIN") {
        admin.role = ADMIN_ROLES.SYSTEM_ADMIN;
        admin.permissions = [...SYSTEM_ADMIN_PERMISSIONS];
        console.log(`✅ Migrated: ${admin.name} (${admin.email})`);
        console.log(`   ${oldRole} → ${admin.role}`);
        console.log(`   Permissions: ${admin.permissions.length} total`);
      } else if (oldRole === "ADMIN") {
        admin.role = ADMIN_ROLES.SUPPORT_ADMIN;
        admin.permissions = [...SUPPORT_ADMIN_PERMISSIONS];
        console.log(`✅ Migrated: ${admin.name} (${admin.email})`);
        console.log(`   ${oldRole} → ${admin.role}`);
        console.log(
          `   Permissions: ${oldPermissions.join(", ")} → ${admin.permissions.length} permissions`,
        );
      } else {
        console.log(
          `⚠️  Unknown role: ${admin.name} (${admin.email}) - ${oldRole}`,
        );
        console.log(
          `   Setting to ${ADMIN_ROLES.SUPPORT_ADMIN} with base permissions`,
        );
        admin.role = ADMIN_ROLES.SUPPORT_ADMIN;
        admin.permissions = [...SUPPORT_ADMIN_PERMISSIONS];
      }

      await admin.save();
      migratedCount++;
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${allAdmins.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during migration:", error);
    process.exit(1);
  } finally {
    // Ensure mongoose connection is closed
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed");
    }
  }
};

// Run the migration
migrateAdminPermissions();
