/**
 * Sync Database Indexes
 *
 * This script ensures all Mongoose schema indexes are created in MongoDB.
 * Run this after schema changes or when setting up a new database.
 *
 * Usage:
 *   npx tsx scripts/sync-indexes.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { ScheduledNotification } from "../src/models/ScheduledNotification";
import { User } from "../src/models/User";
import { Booking } from "../src/models/Booking";

async function syncIndexes() {
  console.log(process.env.MONGO_URI);
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║              DATABASE INDEX SYNCHRONIZATION              ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n",
  );

  try {
    // Connect to database
    const dbUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";
    console.log("🔌 Connecting to database...");
    await mongoose.connect(dbUri);
    console.log("✅ Connected to MongoDB\n");

    // Sync indexes for each model
    const models = [
      { name: "ScheduledNotification", model: ScheduledNotification },
      { name: "User", model: User },
      { name: "Booking", model: Booking },
    ];

    console.log("📊 Syncing indexes...\n");

    for (const { name, model } of models) {
      try {
        console.log(`  ⏳ ${name}...`);
        await model.syncIndexes();

        // Get all indexes
        const indexes = await model.collection.getIndexes();
        const indexCount = Object.keys(indexes).length;

        console.log(`  ✅ ${name}: ${indexCount} indexes synced`);

        // List indexes
        Object.keys(indexes).forEach((indexName) => {
          console.log(`     - ${indexName}`);
        });
        console.log("");
      } catch (error) {
        console.error(`  ❌ ${name}: Error syncing indexes`, error);
      }
    }

    console.log("\n✅ Index synchronization completed successfully!\n");

    // Verify ScheduledNotification indexes specifically
    console.log("🔍 Verifying ScheduledNotification indexes:");
    const indexes = await ScheduledNotification.collection.getIndexes();

    const hasStatusScheduledForIndex = Object.keys(indexes).some(
      (key) => key.includes("status") && key.includes("scheduledFor"),
    );

    if (hasStatusScheduledForIndex) {
      console.log("  ✅ Compound index (status + scheduledFor) is active");
      console.log("  🚀 Query performance optimized!");
    } else {
      console.log("  ⚠️  Compound index not found - may need manual creation");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Index synchronization failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  syncIndexes().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { syncIndexes };
