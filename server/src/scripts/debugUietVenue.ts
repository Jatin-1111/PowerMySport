/**
 * Debug: Check actual venue data in MongoDB
 * Run: npx ts-node src/scripts/debugUietVenue.ts
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { Venue } from "../client/models/Venue";

dotenv.config();

const debug = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const uiet = await Venue.findOne({ name: "UIET" }).lean();

    if (!uiet) {
      console.log("❌ UIET venue not found");
      process.exit(0);
    }

    console.log("📍 UIET Venue Data:");
    console.log("=====================================");
    console.log(`Name: ${(uiet as any).name}`);
    console.log();

    console.log("📸 Images:");
    const images = (uiet as any).images || [];
    const generalImages = (uiet as any).generalImages || [];
    const sportImages = (uiet as any).sportImages || {};
    const generalImageKeys = (uiet as any).generalImageKeys || [];
    const sportImageKeys = (uiet as any).sportImageKeys || {};

    console.log(
      `  images array: ${Array.isArray(images) ? images.length : 0} items`,
    );
    console.log(
      `  generalImages: ${Array.isArray(generalImages) ? generalImages.length : 0} items`,
    );
    console.log(
      `  generalImageKeys: ${Array.isArray(generalImageKeys) ? generalImageKeys.length : 0} items`,
    );

    console.log();
    console.log("🏆 Sport Images:");
    console.log(`  sportImages type: ${typeof sportImages}`);
    console.log(`  sportImages keys: ${Object.keys(sportImages)}`);

    Object.entries(sportImages).forEach(([sport, urls]: [string, any]) => {
      const count = Array.isArray(urls) ? urls.length : 0;
      console.log(`  ${sport}: ${count} images`);
    });

    console.log();
    console.log("Full JSON:");
    console.log(JSON.stringify(uiet, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    console.error(error);
    process.exit(1);
  }
};

debug();
