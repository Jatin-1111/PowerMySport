import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";

dotenv.config();

const LEGACY_UNVERIFIED_VERSION = "legacy-unverified-2026-04";

/**
 * Migration: Backfill legal consent fields for existing users
 * Compliance-safe default: accepted=false with no acceptance timestamp
 */
export async function up(): Promise<void> {
  console.log("Starting migration: Backfill legal consent defaults...");

  try {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/powermysport";
      await mongoose.connect(mongoUri);
      console.log("Connected to database");
    }

    const missingObjectResult = await User.updateMany(
      { legalConsents: { $exists: false } },
      {
        $set: {
          legalConsents: {
            terms: {
              accepted: false,
              version: LEGACY_UNVERIFIED_VERSION,
            },
            privacy: {
              accepted: false,
              version: LEGACY_UNVERIFIED_VERSION,
            },
          },
        },
      },
    );

    const missingTermsResult = await User.updateMany(
      { "legalConsents.terms": { $exists: false } },
      {
        $set: {
          "legalConsents.terms": {
            accepted: false,
            version: LEGACY_UNVERIFIED_VERSION,
          },
        },
      },
    );

    const missingPrivacyResult = await User.updateMany(
      { "legalConsents.privacy": { $exists: false } },
      {
        $set: {
          "legalConsents.privacy": {
            accepted: false,
            version: LEGACY_UNVERIFIED_VERSION,
          },
        },
      },
    );

    console.log("Migration completed successfully:");
    console.log(
      `- Added legalConsents object to ${missingObjectResult.modifiedCount} users`,
    );
    console.log(
      `- Backfilled missing terms consent for ${missingTermsResult.modifiedCount} users`,
    );
    console.log(
      `- Backfilled missing privacy consent for ${missingPrivacyResult.modifiedCount} users`,
    );
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback migration
 * Removes only auto-backfilled legacy-unverified consent entries.
 */
export async function down(): Promise<void> {
  console.log("Rolling back migration: Backfill legal consent defaults...");

  try {
    const result = await User.updateMany(
      {
        "legalConsents.terms.accepted": false,
        "legalConsents.privacy.accepted": false,
        "legalConsents.terms.version": LEGACY_UNVERIFIED_VERSION,
        "legalConsents.privacy.version": LEGACY_UNVERIFIED_VERSION,
        "legalConsents.terms.acceptedAt": { $exists: false },
        "legalConsents.privacy.acceptedAt": { $exists: false },
      },
      {
        $unset: {
          legalConsents: "",
        },
      },
    );

    console.log(
      `Rollback completed: Removed backfilled legal consents from ${result.modifiedCount} users`,
    );
  } catch (error) {
    console.error("Rollback failed:", error);
    throw error;
  }
}

if (require.main === module) {
  const runMigration = async () => {
    try {
      const mongoUri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/powermysport";
      await mongoose.connect(mongoUri);
      console.log("Connected to MongoDB");

      await up();

      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
      process.exit(0);
    } catch (error) {
      console.error("Migration script failed:", error);
      process.exit(1);
    }
  };

  runMigration();
}
