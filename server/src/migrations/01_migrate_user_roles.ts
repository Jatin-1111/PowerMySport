/**
 * Migration Script 1: Update User Roles
 *
 * This script migrates existing user roles to the new role system:
 * - user → PLAYER
 * - vendor → VENUE_LISTER
 * - admin → ADMIN
 *
 * Run this script ONCE after deploying the new User model
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";

dotenv.config();

const migrateUserRoles = async () => {
  try {
    console.log("Starting User Role Migration...");

    // Connect to database
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("Connected to database");

    // Migrate: user → PLAYER
    const userResult = await User.updateMany(
      { role: "user" },
      {
        $set: {
          role: "PLAYER",
          playerProfile: {
            paymentHistory: [],
          },
        },
      },
    );
    console.log(`✅ Migrated ${userResult.modifiedCount} users to PLAYER role`);

    // Migrate: vendor → VENUE_LISTER
    const vendorResult = await User.updateMany(
      { role: "vendor" },
      {
        $set: {
          role: "VENUE_LISTER",
          venueListerProfile: {
            businessDetails: {
              name: "",
              address: "",
            },
            payoutInfo: {
              accountNumber: "",
              ifsc: "",
              bankName: "",
            },
          },
        },
      },
    );
    console.log(
      `✅ Migrated ${vendorResult.modifiedCount} vendors to VENUE_LISTER role`,
    );

    // Migrate: admin → ADMIN (just uppercase)
    const adminResult = await User.updateMany(
      { role: "admin" },
      { $set: { role: "ADMIN" } },
    );
    console.log(
      `✅ Migrated ${adminResult.modifiedCount} admins to ADMIN role`,
    );

    console.log("\n✅ User Role Migration Complete!");
    console.log(
      `Total users migrated: ${userResult.modifiedCount + vendorResult.modifiedCount + adminResult.modifiedCount}`,
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database");
  }
};

// Run migration
if (require.main === module) {
  migrateUserRoles()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateUserRoles };
