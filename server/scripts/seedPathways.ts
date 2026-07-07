import "dotenv/config";
import mongoose from "mongoose";
import { pathwayService } from "../src/shared/services/PathwayService";

const TOP_SPORTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Kabaddi",
  "Athletics",
  "Boxing",
  "Wrestling",
  "Weightlifting",
  "Table Tennis",
  "Hockey",
  "Basketball",
  "Volleyball",
  "Swimming",
  "Gymnastics",
  "Archery",
  "Shooting",
  "Cycling",
  "Judo",
  "Taekwondo",
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully.");

    for (const sport of TOP_SPORTS) {
      console.log(`\n===========================================`);
      console.log(`Fetching/Generating pathway for: ${sport}`);
      try {
        const result = await pathwayService.getOrGeneratePathway(sport);
        console.log(`Result source: ${result.source}`);
        if (result.source === "generated") {
          console.log(`Successfully generated and saved pathway for ${sport}.`);
        } else if (result.source === "db") {
          console.log(`Pathway for ${sport} already exists in DB.`);
        } else {
          console.log(`Failed to process ${sport}: ${result.message}`);
        }
      } catch (error) {
        console.error(`Error processing ${sport}:`, error);
      }

      // Sleep for 2 seconds to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`\n===========================================`);
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
