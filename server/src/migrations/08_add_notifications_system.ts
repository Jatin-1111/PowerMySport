import mongoose from "mongoose";
import Notification from "../models/Notification";
import { User } from "../models/User";
import dotenv from "dotenv";

dotenv.config();

/**
 * Migration: Add notifications system
 * Creates notifications collection with indexes and adds notification preferences to users
 */
export async function up(): Promise<void> {
  console.log("Starting migration: Add notifications system...");

  try {
    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      const mongoUri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/powermysport";
      await mongoose.connect(mongoUri);
      console.log("Connected to database");
    }
    // Create notifications collection with indexes
    // The Notification model already has indexes defined, but we ensure they exist
    const db = mongoose.connection.db;
    const collections = await db
      ?.listCollections({ name: "notifications" })
      .toArray();

    if (collections && collections.length > 0) {
      console.log(
        "Notifications collection exists, dropping to recreate with correct indexes...",
      );
      await db?.collection("notifications").drop();
      console.log("✓ Old notifications collection dropped");
    }

    console.log("Creating notifications collection...");
    await db?.createCollection("notifications");

    // Create indexes explicitly
    await Notification.createIndexes();
    console.log("✓ Notifications collection indexes created");

    // Update existing users to add default notification preferences
    const defaultPreferences = {
      email: {
        friendRequests: true,
        bookingInvitations: true,
        bookingConfirmations: true,
        bookingReminders: true,
        bookingCancellations: true,
        reviews: true,
        payments: true,
        admin: true,
        marketing: false,
      },
      push: {
        friendRequests: true,
        bookingInvitations: true,
        bookingConfirmations: true,
        bookingReminders: true,
        bookingCancellations: true,
        reviews: true,
        payments: true,
        admin: true,
        marketing: false,
      },
      inApp: {
        friendRequests: true,
        bookingInvitations: true,
        bookingConfirmations: true,
        bookingReminders: true,
        bookingCancellations: true,
        reviews: true,
        payments: true,
        admin: true,
        marketing: true,
      },
    };

    const result = await User.updateMany(
      { notificationPreferences: { $exists: false } },
      {
        $set: {
          notificationPreferences: defaultPreferences,
          pushSubscriptions: [],
        },
      },
    );

    console.log(`Migration completed successfully:`);
    console.log(`- Notifications collection created with indexes`);
    console.log(
      `- Updated ${result.modifiedCount} users with default notification preferences`,
    );
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback migration
 */
export async function down(): Promise<void> {
  console.log("Rolling back migration: Add notifications system...");

  try {
    // Drop notifications collection
    const db = mongoose.connection.db;
    await db?.dropCollection("notifications");
    console.log("✓ Notifications collection dropped");

    // Remove notification preferences from users
    const result = await User.updateMany(
      {},
      {
        $unset: {
          notificationPreferences: "",
          pushSubscriptions: "",
        },
      },
    );

    console.log(
      `Rollback completed: Removed notification fields from ${result.modifiedCount} users`,
    );
  } catch (error) {
    console.error("Rollback failed:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const runMigration = async () => {
    try {
      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/powermysport";
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
