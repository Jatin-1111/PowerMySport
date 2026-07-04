import mongoose from "mongoose";
import { User } from "../client/models/User";

export const up = async () => {
  console.log("Starting migration: Remap userType Recreational to Player...");

  const result = await User.updateMany(
    { userType: "Recreational" },
    { $set: { userType: "Player" } }
  );

  console.log(
    `Migration completed successfully. Updated ${result.modifiedCount} users.`
  );
};

export const down = async () => {
  console.log("Rolling back migration: Remap userType Player to Recreational...");

  const result = await User.updateMany(
    { userType: "Player" },
    { $set: { userType: "Recreational" } }
  );

  console.log(
    `Rollback completed successfully. Reverted ${result.modifiedCount} users.`
  );
};
