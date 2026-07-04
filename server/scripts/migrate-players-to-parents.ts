import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/client/models/User";
import { Player } from "../src/client/models/Player";

dotenv.config(); // Ensure env vars are loaded

const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Find all non-Parent PLAYER users
    const candidates = await User.find({ role: "PLAYER", userType: { $ne: "Parent" } });
    
    let migratedCount = 0;
    for (const user of candidates) {
      // Check if this user has any dependents
      const dependentsCount = await Player.countDocuments({ userId: user._id, type: "DEPENDENT" });
      
      if (dependentsCount > 0) {
        console.log(`Migrating user ${user._id} (${user.email}) to Parent...`);
        // We use collection.updateOne to bypass mongoose discriminator key strictness
        await User.collection.updateOne(
          { _id: user._id },
          { $set: { userType: "Parent" } }
        );
        migratedCount++;
      }
    }

    console.log(`Migration complete. Migrated ${migratedCount} users.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

migrate();
