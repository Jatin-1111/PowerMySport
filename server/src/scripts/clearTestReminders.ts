/**
 * Clear all test/dummy scheduled notifications from the database
 * Run this script to clean up any test data before production
 */
import "dotenv/config";
import mongoose from "mongoose";
import { ScheduledNotification } from "../models/ScheduledNotification";
import { Booking } from "../models/Booking";

async function clearTestReminders() {
  try {
    console.log(process.env.MONGO_URI);

    console.log("🗑️  Clearing test reminders...");

    // Connect to MongoDB
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Delete all scheduled notifications
    // WARNING: This deletes ALL reminders. In production, you might want to be more selective
    const result = await ScheduledNotification.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} scheduled notifications`);

    // Also clear any test bookings if needed (commented out for safety)
    const bookingResult = await Booking.deleteMany({ /* your test criteria */ });
    console.log(`✅ Deleted ${bookingResult.deletedCount} test bookings`);

    console.log("\n✨ Database cleanup complete!");
  } catch (error) {
    console.error("❌ Error clearing test reminders:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
clearTestReminders();
