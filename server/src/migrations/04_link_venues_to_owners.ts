/**
 * Migration 04: Link Venues to Owner Accounts
 *
 * This migration:
 * 1. Finds all approved venues without an ownerId
 * 2. Creates user accounts for venue owners if they don't exist
 * 3. Links venues to their respective owner accounts
 *
 * Run: npx ts-node src/migrations/04_link_venues_to_owners.ts
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { User } from "../models/User";
import { Venue } from "../models/Venue";

dotenv.config();

export const linkVenuesToOwners = async () => {
  try {
    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log("🔍 Finding venues without ownerId...");

    // Find all venues without ownerId
    const venuesWithoutOwner = await Venue.find({
      $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    });

    console.log(`📊 Found ${venuesWithoutOwner.length} venues without ownerId`);

    if (venuesWithoutOwner.length === 0) {
      console.log("✅ No venues need migration");
      return;
    }

    let created = 0;
    let linked = 0;
    let errors = 0;

    for (const venue of venuesWithoutOwner) {
      try {
        console.log(`\n🏟️  Processing venue: ${venue.name}`);
        console.log(`   Owner: ${venue.ownerName}`);
        console.log(`   Email: ${venue.ownerEmail}`);
        console.log(`   Phone: ${venue.ownerPhone}`);

        // Check if user already exists
        let user = await User.findOne({
          $or: [{ email: venue.ownerEmail }, { phone: venue.ownerPhone }],
        });

        if (user) {
          console.log(`   ✓ Found existing user: ${user.email}`);

          // Update user role to VENUE_LISTER if not already
          if (user.role !== "VENUE_LISTER") {
            user.role = "VENUE_LISTER";
            if (!user.venueListerProfile) {
              user.venueListerProfile = {
                businessDetails: {
                  name: venue.ownerName,
                  address: venue.address || "",
                },
                payoutInfo: {
                  accountNumber: "",
                  ifsc: "",
                  bankName: "",
                },
                canAddMoreVenues: false,
              };
            }
            await user.save();
            console.log(`   ✓ Updated user role to VENUE_LISTER`);
          }
        } else {
          // Create new user account
          const tempPassword = Math.random().toString(36).slice(-8) + "!A1";

          user = new User({
            name: venue.ownerName,
            email: venue.ownerEmail,
            phone: venue.ownerPhone,
            password: tempPassword, // User model will hash this
            role: "VENUE_LISTER",
            venueListerProfile: {
              businessDetails: {
                name: venue.ownerName,
                address: venue.address || "",
              },
              payoutInfo: {
                accountNumber: "",
                ifsc: "",
                bankName: "",
              },
              canAddMoreVenues: false,
            },
          });

          await user.save();
          console.log(`   ✓ Created new user account`);
          console.log(
            `   ℹ️  Temp password: ${tempPassword} (user should reset this)`,
          );
          created++;
        }

        // Link venue to user
        venue.ownerId = user._id as any;
        await venue.save();
        console.log(`   ✅ Linked venue to owner`);
        linked++;
      } catch (error) {
        console.error(`   ❌ Error processing venue ${venue.name}:`, error);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Total venues processed: ${venuesWithoutOwner.length}`);
    console.log(`👤 New users created: ${created}`);
    console.log(`🔗 Venues linked: ${linked}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  linkVenuesToOwners()
    .then(() => {
      console.log("\n✅ Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}
