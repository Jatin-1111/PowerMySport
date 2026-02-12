/**
 * Migration: Add S3 Keys to Existing Venue Documents and Images
 *
 * This migration extracts S3 keys from existing document URLs and image URLs
 * and stores them in the s3Key/imageKeys fields for future URL regeneration.
 * Run: npx ts-node src/migrations/05_add_s3_keys_to_documents.ts
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { Venue } from "../models/Venue";

dotenv.config();

/**
 * Extract S3 key from full S3 URL
 * From: https://powermysport-verification.s3.ap-south-1.amazonaws.com/venues/123/documents/doc.pdf
 * To: venues/123/documents/doc.pdf
 */
function extractS3Key(url: string): string | null {
  try {
    // Match everything after ".amazonaws.com/"
    const match = url.match(/\.amazonaws\.com\/(.+)$/);
    return match && match[1] ? match[1] : null;
  } catch (error) {
    return null;
  }
}

export const addS3KeysToDocuments = async () => {
  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log("🔍 Finding venues missing S3 keys...");

    // Find all venues
    const venues = await Venue.find({});

    console.log(`📊 Found ${venues.length} venues to process`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const venue of venues) {
      try {
        let venueModified = false;

        // Process documents
        for (const doc of venue.documents) {
          if (!doc.s3Key && doc.url) {
            const s3Key = extractS3Key(doc.url);
            if (s3Key) {
              (doc as any).s3Key = s3Key;
              venueModified = true;
              console.log(
                `   ✓ Added s3Key for document ${doc.fileName}: ${s3Key}`,
              );
            } else {
              console.warn(`   ⚠️  Could not extract s3Key from: ${doc.url}`);
            }
          }
        }

        // Process images
        if (
          venue.images &&
          venue.images.length > 0 &&
          (!venue.imageKeys || venue.imageKeys.length === 0)
        ) {
          const imageKeys: string[] = [];
          for (const imageUrl of venue.images) {
            const s3Key = extractS3Key(imageUrl);
            if (s3Key) {
              imageKeys.push(s3Key);
            } else {
              console.warn(
                `   ⚠️  Could not extract s3Key from image: ${imageUrl}`,
              );
            }
          }
          if (imageKeys.length > 0) {
            (venue as any).imageKeys = imageKeys;
            venueModified = true;
            console.log(`   ✓ Added ${imageKeys.length} image s3Keys`);
          }
        }

        // Process cover photo
        if (venue.coverPhotoUrl && !venue.coverPhotoKey) {
          const s3Key = extractS3Key(venue.coverPhotoUrl);
          if (s3Key) {
            (venue as any).coverPhotoKey = s3Key;
            venueModified = true;
            console.log(`   ✓ Added cover photo s3Key: ${s3Key}`);
          } else {
            console.warn(
              `   ⚠️  Could not extract s3Key from cover photo: ${venue.coverPhotoUrl}`,
            );
          }
        }

        if (venueModified) {
          await venue.save();
          updated++;
          console.log(`✅ Updated venue: ${venue.name}`);
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing venue ${venue.name}:`, error);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Venues updated: ${updated}`);
    console.log(`⏭️  Venues skipped (already had s3Keys): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  addS3KeysToDocuments()
    .then(() => {
      console.log("\n✅ Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}
