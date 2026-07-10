import mongoose from "mongoose";
import { Player } from "../client/models/Player";
import { User } from "../client/models/User";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/power_my_sport",
  );
  const users = await User.find({}).limit(5);
  console.log(
    "Users:",
    users.map((u: any) => ({ id: u._id, name: u.name, email: u.email })),
  );
  const players = await Player.find({});
  console.log("Players:", players);
  process.exit(0);
}

main().catch(console.error);
