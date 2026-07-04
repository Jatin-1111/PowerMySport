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

    const auditLogsCollection = db.collection("adminauditlogs");
    
    const logs = await auditLogsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray();
    console.log(`Found ${logs.length} recent audit logs:`);
    for (const log of logs) {
      console.log(JSON.stringify(log));
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
