/**
 * Migration Script 3: Update Booking Payment Structure
 *
 * This script converts existing bookings from single payment to split payment array.
 * Old bookings will have one payment entry for the venue owner.
 *
 * Run this script ONCE after deploying the new Booking model
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Booking } from "../models/Booking";
import { Venue } from "../models/Venue";

dotenv.config();

const migrateBookingPayments = async () => {
  try {
    console.log("Starting Booking Payment Migration...");

    // Connect to database
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("Connected to database");

    // Find all bookings
    const bookings = await Booking.find({}).populate("venueId");
    console.log(`Found ${bookings.length} bookings to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const booking of bookings) {
      try {
        // Check if booking already has payments array
        if (booking.payments && booking.payments.length > 0) {
          console.log(`Booking ${booking._id} already migrated, skipping`);
          skippedCount++;
          continue;
        }

        // Get venue owner ID
        const venue = booking.venueId as any;
        if (!venue || !venue.ownerId) {
          console.error(`❌ Venue not found for booking ${booking._id}`);
          skippedCount++;
          continue;
        }

        // Get old payment status
        const oldPaymentStatus = (booking as any).paymentStatus || "pending";
        const newPaymentStatus =
          oldPaymentStatus === "paid" ? "PAID" : "PENDING";

        // Create single payment entry for venue owner
        (booking as any).payments = [
          {
            userId: venue.ownerId,
            userType: "VENUE_LISTER",
            amount: booking.totalAmount,
            status: newPaymentStatus,
            paidAt: newPaymentStatus === "PAID" ? booking.createdAt : undefined,
          },
        ];

        // Update status
        const oldStatus = (booking as any).status || "confirmed";
        if (oldStatus === "confirmed" && newPaymentStatus === "PAID") {
          (booking as any).status = "CONFIRMED";
        } else if (oldStatus === "cancelled") {
          (booking as any).status = "CANCELLED";
        } else {
          (booking as any).status = "PENDING_PAYMENT";
        }

        // Set expiration time (10 minutes from creation for old bookings)
        if (!(booking as any).expiresAt) {
          const expiresAt = new Date(booking.createdAt);
          expiresAt.setMinutes(expiresAt.getMinutes() + 10);
          (booking as any).expiresAt = expiresAt;
        }

        // Remove old fields
        (booking as any).paymentStatus = undefined;

        await booking.save();
        migratedCount++;

        console.log(`✅ Migrated booking: ${booking._id}`);
      } catch (error) {
        console.error(`❌ Failed to migrate booking ${booking._id}:`, error);
        skippedCount++;
      }
    }

    console.log("\n✅ Booking Payment Migration Complete!");
    console.log(`Total bookings migrated: ${migratedCount}`);
    console.log(`Bookings skipped: ${skippedCount}`);
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
  migrateBookingPayments()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateBookingPayments };
