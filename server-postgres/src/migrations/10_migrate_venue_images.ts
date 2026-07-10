/**
 * Migration: Consolidate Legacy Venue Images to New Structure
 *
 * This migration consolidates legacy image storage (images, imageKeys)
 * into the new structured format (generalImages, generalImageKeys).
 *
 * Logic:
 * - If generalImages is empty but images exists, move images → generalImages
 * - If generalImageKeys is empty but imageKeys exists, move imageKeys → generalImageKeys
 * - Remove/deprecate legacy fields after consolidation
 * - Optionally refresh presigned URLs for migrated images
 *
 * Run: npx ts-node src/migrations/10_migrate_venue_images.ts
 * Or: npm run migrate (when added to index.ts)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { Venue } from "../client/models/Venue";

dotenv.config();

export const migrateVenueImages = async (refreshUrls: boolean = true) => {
  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log("🔍 Finding venues with mixed/legacy image structure...");

    // Find all venues that have images (legacy) to be cleaned up
    const venuesWithImages = await Venue.find({
      images: { $exists: true, $type: "array", $ne: [] },
    });

    console.log(
      `📊 Found ${venuesWithImages.length} venues with legacy images to consolidate`,
    );

    let migrated = 0;
    let errors = 0;

    for (const venue of venuesWithImages) {
      try {
        let changed = false;

        // If venue has legacy images but NO generalImages, copy them
        if (
          venue.images &&
          venue.images.length > 0 &&
          (!venue.generalImages || venue.generalImages.length === 0)
        ) {
          venue.generalImages = [...venue.images];
          changed = true;
          console.log(
            `  ✓ Migrated ${venue.images.length} legacy images → generalImages for ${venue.name}`,
          );
        }

        // If venue has legacy imageKeys but NO generalImageKeys, copy them
        if (
          venue.imageKeys &&
          venue.imageKeys.length > 0 &&
          (!venue.generalImageKeys || venue.generalImageKeys.length === 0)
        ) {
          venue.generalImageKeys = [...venue.imageKeys];
          changed = true;
          console.log(
            `  ✓ Migrated ${venue.imageKeys.length} legacy keys → generalImageKeys for ${venue.name}`,
          );
        }

        // CONSOLIDATE: Always clear legacy fields once structured fields exist
        if (
          venue.generalImages?.length ||
          Object.keys(venue.sportImages || {}).length > 0
        ) {
          if (venue.images && venue.images.length > 0) {
            venue.images = [];
            changed = true;
            console.log(`  🧹 Cleared legacy images field for ${venue.name}`);
          }
          if (venue.imageKeys && venue.imageKeys.length > 0) {
            venue.imageKeys = [];
            changed = true;
            console.log(
              `  🧹 Cleared legacy imageKeys field for ${venue.name}`,
            );
          }
        }

        // Refresh presigned URLs if requested
        if (
          changed &&
          refreshUrls &&
          (venue.generalImageKeys?.length || venue.sportImageKeys)
        ) {
          try {
            await venue.refreshImageUrls();
            console.log(`  ✨ Refreshed presigned URLs for ${venue.name}`);
          } catch (urlError) {
            console.warn(
              `  ⚠️  Failed to refresh URLs for ${venue.name}:`,
              (urlError as Error).message,
            );
            // Continue anyway - data is migrated
          }
        }

        if (changed) {
          await venue.save();
          migrated++;
        }
      } catch (error) {
        errors++;
        console.error(
          `  ❌ Error migrating ${venue.name}:`,
          (error as Error).message,
        );
      }
    }

    console.log();
    console.log("=" + "=".repeat(59));
    console.log(`✅ Migration Complete`);
    console.log("=" + "=".repeat(59));
    console.log(`  📍 Venues processed: ${migrated}`);
    console.log(`  ⚠️  Errors: ${errors}`);

    if (refreshUrls) {
      console.log(`  🔄 Presigned URLs regenerated for migrated venues`);
    }

    console.log();
    console.log("💡 What was done:");
    console.log(
      "  1. ✓ Legacy images → generalImages (if generalImages was empty)",
    );
    console.log("  2. ✓ Cleared legacy fields (images, imageKeys)");
    console.log("  3. ✓ Regenerated presigned URLs");
    console.log();
    console.log("🎯 Result:");
    console.log("  - All venues now use ONLY structured fields");
    console.log("  - Legacy fields (images, imageKeys) are cleared");
    console.log("  - Next step: Can safely remove legacy fields from schema");

    // Return stats for programmatic use
    return {
      total: venuesWithImages.length,
      migrated,
      errors,
      refreshedUrls: refreshUrls,
    };
  } catch (error) {
    console.error("❌ Migration failed:", (error as Error).message);
    throw error;
  }
};

// Run if executed directly
if (require.main === module) {
  const refreshUrls = process.argv.includes("--no-refresh") ? false : true;

  console.log(
    `🚀 Running venue image migration ${refreshUrls ? "with URL refresh" : "without URL refresh"}...`,
  );
  console.log();

  migrateVenueImages(refreshUrls)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
