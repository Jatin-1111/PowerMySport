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

    const coachesCollection = db.collection("coaches");
    
    const updateResult = await coachesCollection.updateMany(
      {},
      {
        $set: {
          isVerified: true,
          verificationStatus: "VERIFIED",
          verifiedAt: new Date()
        }
      }
    );
    
    console.log(`Successfully verified ${updateResult.modifiedCount} coaches.`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

run();
