import "dotenv/config";
import mongoose from "mongoose";
import { User } from "./src/client/models/User";

async function main() {
  const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/powermysport";
  await mongoose.connect(MONGODB_URI);
  const res = await User.deleteOne({ email: "community-auth-test-4471@powermysport.com" });
  console.log("Deleted:", res.deletedCount);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
