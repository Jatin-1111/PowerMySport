import "dotenv/config";
import mongoose from "mongoose";

/**
 * Community is now Parent-only, so a group's PLAYERS_ONLY/COACHES_ONLY
 * audience restriction can never again be satisfied by anyone joining —
 * every future member is a Parent. Rather than leave existing groups stuck
 * unjoinable, this collapses every group's audience to ALL, matching the
 * narrowed CommunityGroupAudience type (now just "ALL") and the schema's
 * narrowed enum. See server/src/community/services/communityShared.ts's
 * COMMUNITY_ALLOWED_ROLES and communityPolicy.ts's canJoinGroupAudience.
 */
export const up = async () => {
  console.log("Starting migration: Collapse community group audience to ALL...");
  const groups = mongoose.connection.collection("communitygroups");

  const before = await groups.countDocuments({
    audience: { $in: ["PLAYERS_ONLY", "COACHES_ONLY"] },
  });
  console.log(`Found ${before} groups tagged PLAYERS_ONLY or COACHES_ONLY.`);

  const res = await groups.updateMany(
    { audience: { $in: ["PLAYERS_ONLY", "COACHES_ONLY"] } },
    { $set: { audience: "ALL" } }
  );
  console.log(`Collapsed ${res.modifiedCount} groups' audience to ALL.`);

  console.log("Migration completed successfully.");
};

export const down = async () => {
  console.log("Rolling back migration: Collapse community group audience to ALL...");
  console.log(
    "No-op: which groups were originally PLAYERS_ONLY vs COACHES_ONLY was not recorded, so this cannot be un-collapsed. A full rollback also requires reverting the accompanying code changes (the narrowed CommunityGroupAudience type/schema enum)."
  );
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/powermysport";

  const rollback = process.argv.includes("--down");

  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("Connected to MongoDB");
      return rollback ? down() : up();
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
