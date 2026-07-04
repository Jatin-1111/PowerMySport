import "dotenv/config";
import mongoose from "mongoose";
import { CommunityProfile } from "../community/models/CommunityProfile";
import { User } from "../client/models/User";

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/powermysport";

const makeDefaultAlias = (name?: string): string => {
  const seed = Math.floor(1000 + Math.random() * 9000);
  const safeName = name?.trim().split(" ")[0] || "Member";
  return `${safeName}-${seed}`;
};

const run = async () => {
  try {
    if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
      console.log("⚠️  Warning: Using default local MongoDB connection");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const players = await User.find({ role: "Player" })
      .select("_id name role")
      .lean();

    if (players.length === 0) {
      console.log("\n✅ No player accounts found in the database");
      process.exit(0);
    }

    console.log(`\n🔍 Found ${players.length} player account(s)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const playerIds = players.map((player) => String(player._id));

    const existingProfiles = await CommunityProfile.find({
      userId: { $in: playerIds },
    })
      .select("userId isIdentityPublic")
      .lean();

    const existingProfileIds = new Set(
      existingProfiles.map((profile) => String(profile.userId)),
    );

    const updateResult = await CommunityProfile.updateMany(
      { userId: { $in: playerIds } },
      { $set: { isIdentityPublic: true } },
    );

    const missingPlayers = players.filter(
      (player) => !existingProfileIds.has(String(player._id)),
    );

    let createdCount = 0;
    if (missingPlayers.length > 0) {
      const bulkOps = missingPlayers.map((player) => ({
        updateOne: {
          filter: { userId: player._id },
          update: {
            $setOnInsert: {
              userId: player._id,
              anonymousAlias: makeDefaultAlias(player.name),
              isIdentityPublic: true,
            },
          },
          upsert: true,
        },
      }));

      const bulkResult = await CommunityProfile.bulkWrite(bulkOps);
      createdCount = bulkResult.upsertedCount || 0;
    }

    console.log(`✅ Updated ${updateResult.matchedCount} existing profile(s)`);
    console.log(`✅ Marked ${updateResult.modifiedCount} profile(s) public`);
    console.log(`✅ Created ${createdCount} missing public profile(s)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✅ Player community profiles are now public");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error updating player profiles:", error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed");
    }
  }
};

run();
