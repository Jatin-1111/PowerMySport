import { Booking } from "../models/Booking";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/**
 * Migration: Add group booking support
 * Backfills existing bookings with new group booking fields
 */
export async function up(): Promise<void> {
  console.log("Starting migration: Add group booking support...");

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
    // Update all existing bookings to set default values for new fields
    const result = await Booking.updateMany(
      {
        $or: [
          { bookingType: { $exists: false } },
          { organizerId: { $exists: false } },
          { paymentType: { $exists: false } },
        ],
      },
      {
        $set: {
          bookingType: "INDIVIDUAL",
          paymentType: "SINGLE",
          participants: [],
        },
        $setOnInsert: {
          // Set organizerId to userId if it doesn't exist
        },
      },
    );

    // Set organizerId to userId for all bookings that don't have it
    // Using aggregation pipeline requires accessing the native collection
    const bookingsWithoutOrganizer = await Booking.collection.updateMany(
      { organizerId: { $exists: false } },
      [
        {
          $set: {
            organizerId: "$userId",
          },
        },
      ],
    );

    console.log(`Migration completed successfully:`);
    console.log(
      `- Updated ${result.modifiedCount} bookings with group booking defaults`,
    );
    console.log(
      `- Set organizerId for ${bookingsWithoutOrganizer.modifiedCount} bookings`,
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
  console.log("Rolling back migration: Add group booking support...");

  try {
    // Remove group booking fields from all bookings
    const result = await Booking.updateMany(
      {},
      {
        $unset: {
          bookingType: "",
          organizerId: "",
          participants: "",
          paymentType: "",
          splitMethod: "",
        },
      },
    );

    console.log(
      `Rollback completed: Removed group booking fields from ${result.modifiedCount} bookings`,
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
      console.error("Migration error:", error);
      process.exit(1);
    }
  };

  runMigration();
}
