import "dotenv/config";
import mongoose from "mongoose";

/**
 * Parent accounts were stored as role:"Player" + userType:"Parent" — the only
 * thing distinguishing a Parent from a self-registering Athlete was the
 * userType field (which was also, confusingly, the Mongoose discriminatorKey
 * on this schema). This migration gives Parent its own first-class role
 * value (role:"Parent" is already a valid enum entry, just never written)
 * and drops userType/the discriminator mechanism entirely.
 *
 * NOTE: uses the raw collection, not the User model — Mongoose silently
 * no-ops any attempt to $unset a discriminatorKey field via Model.updateMany
 * (reports a successful modifiedCount without actually touching the field).
 * AuthService.ts's updateProfile already works around this same limitation
 * the same way.
 */
export const up = async () => {
  console.log("Starting migration: Split Parent role from Player...");
  const users = mongoose.connection.collection("users");

  const parentsBefore = await users.countDocuments({
    role: "Player",
    userType: "Parent",
  });
  console.log(`Found ${parentsBefore} Parent accounts stored as role:Player.`);

  const parentRes = await users.updateMany(
    { role: "Player", userType: "Parent" },
    { $set: { role: "Parent" }, $unset: { userType: "" } }
  );
  console.log(
    `Migrated ${parentRes.modifiedCount} users from role:Player+userType:Parent to role:Parent.`
  );

  // Everyone else (Player, Coach, VenueLister, Academy, EXPERT, Admin) keeps
  // their existing role — just drop the now-removed userType field.
  const cleanupRes = await users.updateMany(
    { userType: { $exists: true } },
    { $unset: { userType: "" } }
  );
  console.log(`Removed userType field from ${cleanupRes.modifiedCount} remaining users.`);

  console.log("Migration completed successfully.");
};

export const down = async () => {
  console.log("Rolling back migration: Split Parent role from Player...");
  const users = mongoose.connection.collection("users");

  const res = await users.updateMany(
    { role: "Parent" },
    { $set: { role: "Player", userType: "Parent" } }
  );
  console.log(
    `Reverted ${res.modifiedCount} users from role:Parent back to role:Player+userType:Parent.`
  );
  console.log(
    "Note: userType was NOT restored for non-Parent users — their original values weren't recorded (they were never anything but a duplicate of role). A full rollback also requires reverting the accompanying code changes."
  );

  console.log("Rollback completed.");
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
