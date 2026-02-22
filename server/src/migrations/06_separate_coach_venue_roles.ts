/**
 * Migration: Separate Coach and Venue-Lister Roles
 *
 * This migration enforces the separation of coach and venue-lister functionalities:
 * 1. Moves venue data from separate Venue documents into coach profiles (ownVenueDetails)
 * 2. Removes venueId references from Coach documents
 * 3. Deletes orphaned venues that were created by coaches
 *
 * Coaches who want to list rentable venues must create separate venue-lister credentials.
 */

import mongoose from "mongoose";
import { Coach, CoachDocument } from "../models/Coach";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import dotenv from "dotenv";

dotenv.config();

interface MigrationLog {
  totalCoachesWithVenues: number;
  successfulMigrations: number;
  failedMigrations: number;
  orphanedVenuesDeleted: number;
  errors: Array<{
    coachId: string;
    error: string;
  }>;
}

async function migrateCoachVenueToProfile() {
  const log: MigrationLog = {
    totalCoachesWithVenues: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    orphanedVenuesDeleted: 0,
    errors: [],
  };

  try {
    console.log("=== Starting Coach-Venue Separation Migration ===\n");

    // Connect to database
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to database");

    // Find all coaches with venueId populated (using any to access legacy field)
    const coachesWithVenues = (await Coach.find({
      venueId: { $exists: true, $ne: null },
    }).lean()) as any[];

    log.totalCoachesWithVenues = coachesWithVenues.length;
    console.log(
      `\n✓ Found ${log.totalCoachesWithVenues} coaches with venue references\n`,
    );

    // Migrate each coach's venue data to their profile
    for (const coach of coachesWithVenues) {
      try {
        console.log(
          `Migrating coach ${coach._id} (venueId: ${coach.venueId})...`,
        );

        // Fetch the associated venue
        const venue = await Venue.findById(coach.venueId);

        if (!venue) {
          console.log(
            `  ⚠ Warning: Venue ${coach.venueId} not found, removing reference`,
          );
          await Coach.updateOne(
            { _id: coach._id },
            { $unset: { venueId: "" } },
          );
          log.successfulMigrations++;
          continue;
        }

        // Build ownVenueDetails from venue data
        const ownVenueDetails = {
          name: venue.name,
          address: venue.address || "",
          location: venue.location,
          sports: venue.sports,
          amenities: venue.amenities || [],
          pricePerHour: venue.pricePerHour,
          description: venue.description || "",
          images: venue.images || [],
          imageS3Keys: venue.imageKeys || [],
          openingHours: venue.openingHours || "09:00-17:00",
        };

        // Update coach with ownVenueDetails and remove venueId
        await Coach.updateOne(
          { _id: coach._id },
          {
            $set: { ownVenueDetails },
            $unset: { venueId: "" },
          },
        );

        console.log(`  ✓ Migrated venue data to coach profile`);
        log.successfulMigrations++;

        // Mark venue for deletion (we'll delete all coach-owned venues at the end)
        console.log(`  • Venue ${venue._id} marked for deletion`);
      } catch (error) {
        console.error(`  ✗ Error migrating coach ${coach._id}:`, error);
        log.failedMigrations++;
        log.errors.push({
          coachId: coach._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Delete all orphaned venues created by coaches
    console.log("\n=== Cleaning up orphaned coach-created venues ===\n");

    // Find all users with COACH role
    const coachUsers = await User.find({ role: "COACH" }).select("_id");
    const coachUserIds = coachUsers.map((u) => u._id.toString());

    console.log(`Found ${coachUserIds.length} coach users`);

    // Delete venues owned by coaches (these are the "ghost venues")
    const deleteResult = await Venue.deleteMany({
      ownerId: { $in: coachUserIds },
    });

    log.orphanedVenuesDeleted = deleteResult.deletedCount || 0;
    console.log(`✓ Deleted ${log.orphanedVenuesDeleted} coach-owned venues\n`);

    // Print migration summary
    console.log("=== Migration Summary ===");
    console.log(`Total coaches with venues: ${log.totalCoachesWithVenues}`);
    console.log(`Successful migrations: ${log.successfulMigrations}`);
    console.log(`Failed migrations: ${log.failedMigrations}`);
    console.log(`Orphaned venues deleted: ${log.orphanedVenuesDeleted}`);

    if (log.errors.length > 0) {
      console.log("\n=== Errors ===");
      log.errors.forEach((err) => {
        console.log(`Coach ${err.coachId}: ${err.error}`);
      });
    }

    console.log("\n✓ Migration completed successfully");
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✓ Disconnected from database");
  }

  return log;
}

// Run migration if executed directly
if (require.main === module) {
  migrateCoachVenueToProfile()
    .then(() => {
      console.log("\n✓ Done");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n✗ Migration failed:", error);
      process.exit(1);
    });
}

export { migrateCoachVenueToProfile };
