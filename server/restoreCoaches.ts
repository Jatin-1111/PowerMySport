import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    
    const db = mongoose.connection.db;
    if (!db) return;

    const usersCollection = db.collection("users");
    const coachesCollection = db.collection("coaches");
    
    const coaches = await usersCollection.find({ role: "Coach" }).toArray();
    let restoredCount = 0;
    
    for (const coachUser of coaches) {
      const existingProfile = await coachesCollection.findOne({ userId: coachUser._id });
      
      if (!existingProfile) {
        // Create an empty basic profile
        await coachesCollection.insertOne({
          userId: coachUser._id,
          bio: "",
          certifications: [],
          sports: [],
          hourlyRate: 0,
          serviceMode: "OFFLINE",
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0
        });
        restoredCount++;
      }
    }
    
    console.log(`Restored/Created ${restoredCount} coach profiles.`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
