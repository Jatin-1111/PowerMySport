/**
 * Migration Script 2: Update Venue Locations to GeoJSON
 *
 * This script converts string-based venue locations to GeoJSON Point format.
 * Since we cannot geocode addresses automatically without an API key,
 * this script sets default coordinates and flags venues for manual update.
 *
 * Run this script ONCE after deploying the new Venue model
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Venue } from "../models/Venue";

dotenv.config();

const migrateVenueLocations = async () => {
  try {
    console.log("Starting Venue Location Migration...");

    // Connect to database
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("Connected to database");

    // Find all venues with string location (old schema)
    const venues = await Venue.find({});
    console.log(`Found ${venues.length} venues to migrate`);

    let migratedCount = 0;
    let flaggedCount = 0;

    for (const venue of venues) {
      try {
        // Check if location is already GeoJSON
        if (
          typeof venue.location === "object" &&
          venue.location.type === "Point" &&
          Array.isArray(venue.location.coordinates)
        ) {
          console.log(
            `Venue ${venue.name} already has GeoJSON location, skipping`,
          );
          continue;
        }

        // Set default coordinates (0, 0) and flag for manual update
        // In production, you might want to use a geocoding service here
        (venue as any).location = {
          type: "Point",
          coordinates: [0, 0], // [longitude, latitude]
        };
        (venue as any).requiresLocationUpdate = true;

        await venue.save();
        migratedCount++;
        flaggedCount++;

        console.log(
          `✅ Migrated venue: ${venue.name} (flagged for location update)`,
        );
      } catch (error) {
        console.error(`❌ Failed to migrate venue ${venue.name}:`, error);
      }
    }

    console.log("\n✅ Venue Location Migration Complete!");
    console.log(`Total venues migrated: ${migratedCount}`);
    console.log(`Venues flagged for manual location update: ${flaggedCount}`);
    console.log(
      "\n⚠️  IMPORTANT: Venue owners should update their locations via the dashboard",
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
  migrateVenueLocations()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateVenueLocations };
