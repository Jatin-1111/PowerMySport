import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../models/User";
import { Venue } from "../models/Venue";

/**
 * This script updates all venues without ownerIds
 * Run this to fix old test venues
 */
async function fixVenueOwnerIds() {
  try {
    await connectDB();
    console.log("\n=== Fixing Venue OwnerIds ===\n");

    // Get all venues without ownerId
    const venuesWithoutOwner = await Venue.find({
      $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    });

    console.log(`Found ${venuesWithoutOwner.length} venues without ownerIds\n`);

    if (venuesWithoutOwner.length === 0) {
      console.log("All venues have ownerIds. Nothing to fix!");
      process.exit(0);
    }

    // Get the first admin or create a default owner
    let defaultOwner = await User.findOne({ role: "ADMIN" });

    if (!defaultOwner) {
      // Try to find any user
      defaultOwner = await User.findOne({});
    }

    if (!defaultOwner) {
      console.log("No users found in database. Cannot assign ownerId.");
      console.log("Please create a user first.");
      process.exit(1);
    }

    console.log(
      `Using user ${defaultOwner.email} (${defaultOwner._id}) as default owner\n`,
    );

    // Update all venues
    const result = await Venue.updateMany(
      {
        $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
      },
      {
        $set: {
          ownerId: defaultOwner._id,
          approvalStatus: "APPROVED", // Auto-approve old venues
        },
      },
    );

    console.log(`\n✅ Updated ${result.modifiedCount} venues`);
    console.log(`   - Set ownerId to: ${defaultOwner._id}`);
    console.log(`   - Set approvalStatus to: APPROVED`);

    // Show summary
    const allVenues = await Venue.find({});
    const withOwner = allVenues.filter((v) => v.ownerId);
    const withoutOwner = allVenues.filter((v) => !v.ownerId);

    console.log(`\n=== Current Status ===`);
    console.log(`Total venues: ${allVenues.length}`);
    console.log(`With ownerId: ${withOwner.length}`);
    console.log(`Without ownerId: ${withoutOwner.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixVenueOwnerIds();
