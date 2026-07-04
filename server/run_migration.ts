import mongoose from "mongoose";
import dotenv from "dotenv";
import { up } from "./src/migrations/17_unify_user_roles";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/powermysport");
    console.log("Connected to MongoDB.");
    await up();
    console.log("Migration executed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

run();
