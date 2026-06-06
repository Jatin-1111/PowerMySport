/**
 * Debug Script: Inspect Venue Image Structure
 *
 * Check what image fields venues actually have
 * Run: npx ts-node src/scripts/debugVenueImages.ts
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { Venue } from "../client/models/Venue";

dotenv.config();

const debugVenueImages = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log("🔍 Fetching sample venues...\n");

    const venues = await Venue.find({}).limit(5);

    console.log(`Found ${venues.length} venues:\n`);

    for (const venue of venues) {
      console.log(`📍 ${venue.name}`);
      console.log(
        `  images: ${Array.isArray(venue.images) ? venue.images.length : "N/A"} items`,
      );
      console.log(
        `  imageKeys: ${Array.isArray(venue.imageKeys) ? venue.imageKeys.length : "N/A"} items`,
      );
      console.log(
        `  generalImages: ${Array.isArray(venue.generalImages) ? venue.generalImages.length : "N/A"} items`,
      );
      console.log(
        `  generalImageKeys: ${Array.isArray(venue.generalImageKeys) ? venue.generalImageKeys.length : "N/A"} items`,
      );

      if (venue.sportImages) {
        const sportCount = Object.keys(venue.sportImages).length;
        console.log(`  sportImages: ${sportCount} sports`);
        Object.entries(venue.sportImages).forEach(([sport, images]) => {
          const imgArray = Array.isArray(images) ? images : [];
          console.log(`    - ${sport}: ${imgArray.length} images`);
        });
      } else {
        console.log(`  sportImages: N/A`);
      }

      console.log();
    }

    // Count venues by image structure
    console.log("\n📊 Image Structure Summary:");
    console.log("========================================");

    const withLegacy = await Venue.countDocuments({
      images: { $exists: true, $type: "array", $ne: [] },
    });
    console.log(`Venues with legacy images array: ${withLegacy}`);

    const withGeneral = await Venue.countDocuments({
      generalImages: { $exists: true, $type: "array", $ne: [] },
    });
    console.log(`Venues with generalImages: ${withGeneral}`);

    const withSportImages = await Venue.countDocuments({
      sportImages: { $exists: true },
    });
    console.log(`Venues with sportImages: ${withSportImages}`);

    const emptyGeneral = await Venue.countDocuments({
      $or: [{ generalImages: { $exists: false } }, { generalImages: [] }],
    });
    console.log(`Venues with empty/missing generalImages: ${emptyGeneral}`);

    console.log("\n🔍 Venues that NEED migration:");
    const needsMigration = await Venue.countDocuments({
      images: { $exists: true, $ne: [] },
      $or: [{ generalImages: { $exists: false } }, { generalImages: [] }],
    });
    console.log(`Count: ${needsMigration}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Debug failed:", (error as Error).message);
    process.exit(1);
  }
};

if (require.main === module) {
  debugVenueImages();
}

export { debugVenueImages };
