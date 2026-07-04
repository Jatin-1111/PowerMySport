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

  console.log("Rollback completed successfully.");
};
