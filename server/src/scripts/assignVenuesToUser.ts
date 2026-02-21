import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { Venue } from "../models/Venue";

/**
 * Assign all venues to a specific user
 * Usage: npx ts-node src/scripts/assignVenuesToUser.ts <userId>
 */
async function assignVenuesToUser() {
  try {
    await connectDB();

    const userId = process.argv[2];

    if (!userId) {
      console.log(
        "\nUsage: npx ts-node src/scripts/assignVenuesToUser.ts <userId>",
      );
      console.log("\nTo find your userId:");
      console.log("1. Login to your app");
      console.log("2. Open browser console");
      console.log("3. Run: localStorage.getItem('user')");
      console.log("4. Copy the 'id' value\n");
      process.exit(1);
    }

    console.log(`\nAssigning all venues to user: ${userId}\n`);

    // Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid userId format. Must be a valid MongoDB ObjectId.");
      process.exit(1);
    }

    const ownerObjectId = new mongoose.Types.ObjectId(userId);

    // Update all venues
    const result = await Venue.updateMany(
      {},
      {
        $set: {
          ownerId: ownerObjectId,
          approvalStatus: "APPROVED",
        },
      },
    );

    console.log(`✅ Updated ${result.modifiedCount} venues`);
    console.log(`   - Set ownerId to: ${userId}`);
    console.log(`   - Set approvalStatus to: APPROVED\n`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

assignVenuesToUser();
