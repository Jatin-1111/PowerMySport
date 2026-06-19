import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { up } from '../migrations/13_parent_dependent_pivot';

dotenv.config();

const run = async () => {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";
  
  await mongoose.connect(mongoUri);
  console.log("Connected to database");

  try {
    await up();
    console.log("Migration 13 executed successfully!");
  } catch (err) {
    console.error("Migration 13 failed", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database");
  }
};

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
