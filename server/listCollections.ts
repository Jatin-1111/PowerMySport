import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    if (!db) return;

    const collections = await db.listCollections().toArray();
    console.log("Collections in DB:");
    collections.forEach(c => console.log(c.name));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
