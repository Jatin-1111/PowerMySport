import "dotenv/config";
import { connectDB } from "../config/database";
import { Venue } from "../models/Venue";

async function checkVenues() {
  try {
    await connectDB();
    console.log("\n=== Checking All Venues in Database ===\n");

    const allVenues = await Venue.find({}).lean();

    console.log(`Total venues in database: ${allVenues.length}\n`);

    allVenues.forEach((venue, index) => {
      console.log(`\n--- Venue ${index + 1} ---`);
      console.log(`ID: ${venue._id}`);
      console.log(`Name: ${venue.name}`);
      console.log(`Owner ID: ${venue.ownerId}`);
      console.log(`Approval Status: ${venue.approvalStatus}`);
      console.log(`Sports: ${venue.sports.join(", ")}`);
      console.log(`Location: ${JSON.stringify(venue.location)}`);
      console.log(`Created At: ${venue.createdAt}`);
    });

    // Group by approval status
    const statusGroups = allVenues.reduce((acc: any, venue) => {
      const status = venue.approvalStatus;
      if (!acc[status]) acc[status] = [];
      acc[status].push(venue);
      return acc;
    }, {});

    console.log("\n=== Venues by Approval Status ===");
    Object.keys(statusGroups).forEach((status) => {
      console.log(`${status}: ${statusGroups[status].length} venues`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkVenues();
