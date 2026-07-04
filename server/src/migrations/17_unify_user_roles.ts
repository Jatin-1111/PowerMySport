import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../client/models/User";

export const up = async () => {
  console.log("Starting migration: Unify User Roles...");

  // Update PLAYER -> Player
  let res = await User.updateMany({ role: "PLAYER" }, { $set: { role: "Player" } });
  console.log(`Updated ${res.modifiedCount} users from PLAYER to Player.`);

  // Update VENUE_LISTER -> VenueLister
  res = await User.updateMany({ role: "VENUE_LISTER" }, { $set: { role: "VenueLister" } });
  console.log(`Updated ${res.modifiedCount} users from VENUE_LISTER to VenueLister.`);

  // Update COACH -> Coach
  res = await User.updateMany({ role: "COACH" }, { $set: { role: "Coach" } });
  console.log(`Updated ${res.modifiedCount} users from COACH to Coach.`);

  // Update ACADEMY_OWNER -> Academy
  res = await User.updateMany({ role: "ACADEMY_OWNER" }, { $set: { role: "Academy" } });
  console.log(`Updated ${res.modifiedCount} users from ACADEMY_OWNER to Academy.`);

  // Update ADMIN -> Admin
  res = await User.updateMany({ role: "ADMIN" }, { $set: { role: "Admin" } });
  console.log(`Updated ${res.modifiedCount} users from ADMIN to Admin.`);

  // Update PARENT -> Parent
  res = await User.updateMany({ role: "PARENT" }, { $set: { role: "Parent" } });
  console.log(`Updated ${res.modifiedCount} users from PARENT to Parent.`);

  console.log("Migration completed successfully.");
};

export const down = async () => {
  console.log("Rolling back migration: Unify User Roles...");

  let res = await User.updateMany({ role: "Player" }, { $set: { role: "PLAYER" } });
  console.log(`Reverted ${res.modifiedCount} users from Player to PLAYER.`);

  res = await User.updateMany({ role: "VenueLister" }, { $set: { role: "VENUE_LISTER" } });
  console.log(`Reverted ${res.modifiedCount} users from VenueLister to VENUE_LISTER.`);

  res = await User.updateMany({ role: "Coach" }, { $set: { role: "COACH" } });
  console.log(`Reverted ${res.modifiedCount} users from Coach to COACH.`);

  res = await User.updateMany({ role: "Academy" }, { $set: { role: "ACADEMY_OWNER" } });
  console.log(`Reverted ${res.modifiedCount} users from Academy to ACADEMY_OWNER.`);

  res = await User.updateMany({ role: "Admin" }, { $set: { role: "ADMIN" } });
  console.log(`Reverted ${res.modifiedCount} users from Admin to ADMIN.`);

  res = await User.updateMany({ role: "Parent" }, { $set: { role: "PARENT" } });
  console.log(`Reverted ${res.modifiedCount} users from Parent to PARENT.`);

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
