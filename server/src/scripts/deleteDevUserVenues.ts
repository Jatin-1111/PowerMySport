import "dotenv/config";
import mongoose from "mongoose";
import { Venue, VenueDocument } from "../models/Venue";

const deleteDevUserVenues = async () => {
  try {
    const MONGODB_URI =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find venues where ownerName or name contains "dev user" (case-insensitive)
    const venues = await Venue.find({
      $or: [
        { ownerName: { $regex: /dev user/i } },
        { name: { $regex: /dev user/i } },
      ],
    });

    if (venues.length === 0) {
      console.log("No venues found with 'dev user' in name or owner name.");
      process.exit(0);
    }

    console.log(`Found ${venues.length} venue(s) to delete:`);
    venues.forEach((v: VenueDocument) => {
      console.log(`  - ID: ${v._id} | Name: ${v.name} | Owner: ${v.ownerName}`);
    });

    const result = await Venue.deleteMany({
      $or: [
        { ownerName: { $regex: /dev user/i } },
        { name: { $regex: /dev user/i } },
      ],
    });

    console.log(`\n✅ Deleted ${result.deletedCount} venue(s) successfully.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

deleteDevUserVenues();
