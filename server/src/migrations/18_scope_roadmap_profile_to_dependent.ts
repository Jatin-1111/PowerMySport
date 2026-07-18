import "dotenv/config";
import mongoose from "mongoose";
import { UserPathwayProfile } from "../shared/models/UserPathwayProfile";
import { Player } from "../client/models/Player";

/**
 * UserPathwayProfile (saved tournaments, progress, applications on /roadmap)
 * used to be keyed only by userId, so a parent with multiple children had
 * both kids' data collapse into one shared bucket. This backfills existing
 * profiles onto the parent's first dependent (oldest by createdAt) where one
 * exists, and fixes the unique index from {userId} to {userId, dependentId}.
 */
export const up = async () => {
  console.log("Starting migration: Scope roadmap profile to dependent...");

  const profiles = await UserPathwayProfile.find({
    dependentId: { $exists: false },
  }).lean();
  console.log(`Found ${profiles.length} pre-existing profile(s) to backfill.`);

  let attached = 0;
  let leftGeneral = 0;

  for (const profile of profiles) {
    const firstDependent = await Player.findOne({
      userId: profile.userId,
      type: "DEPENDENT",
    })
      .sort({ createdAt: 1 })
      .lean();

    if (firstDependent) {
      await UserPathwayProfile.updateOne(
        { _id: profile._id },
        { $set: { dependentId: firstDependent._id } },
      );
      attached++;
    } else {
      // No dependent to attach to yet — explicitly set null so it occupies
      // the "general" slot in the new {userId, dependentId} unique index.
      await UserPathwayProfile.updateOne(
        { _id: profile._id },
        { $set: { dependentId: null } },
      );
      leftGeneral++;
    }
  }
  console.log(`Attached ${attached} profile(s) to a dependent.`);
  console.log(`Left ${leftGeneral} profile(s) in the general (no-dependent) bucket.`);

  // Drop the old single-field unique index and create the new compound one,
  // based on whatever the current schema declares.
  try {
    await UserPathwayProfile.collection.dropIndex("userId_1");
    console.log("Dropped old userId_1 unique index.");
  } catch (error) {
    console.log("No userId_1 index to drop (already removed or never existed).");
  }
  await UserPathwayProfile.syncIndexes();
  console.log("Synced indexes to {userId, dependentId} unique compound index.");

  console.log("Migration completed successfully.");
};

export const down = async () => {
  console.log("Rolling back migration: Scope roadmap profile to dependent...");

  const res = await UserPathwayProfile.updateMany(
    {},
    { $unset: { dependentId: "" } },
  );
  console.log(`Removed dependentId from ${res.modifiedCount} profile(s).`);
  console.log(
    "Note: index shape is not reverted automatically — re-run the previous schema's syncIndexes() if needed.",
  );

  console.log("Rollback completed successfully.");
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

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
