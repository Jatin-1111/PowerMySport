import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      console.log("No db connection");
      return;
    }

    const coachesCollection = db.collection("coaches");
    const usersCollection = db.collection("users");
    
    const coaches = await coachesCollection.find({}).toArray();
    console.log(`Found ${coaches.length} total coaches in 'coaches' collection`);
    
    let deletedCount = 0;
    
    for (const coach of coaches) {
      const u = coach.user ? await usersCollection.findOne({ _id: coach.user }) : null;
      console.log(`Coach: ${coach._id}, user_id: ${coach.user}, user_name: ${u ? u.name : 'MISSING USER'}`);
      
      // Let's actually delete those with MISSING USER or name "Unnamed coach" or ""
      if (!u || u.name === "Unnamed coach" || !u.name || typeof u.name !== 'string') {
          console.log(`DELETING -> Coach Profile: ${coach._id}`);
          await coachesCollection.deleteOne({ _id: coach._id });
          if (coach.user) {
              await usersCollection.deleteOne({ _id: coach.user });
          }
          deletedCount++;
      }
    }
    
    console.log(`Total deleted: ${deletedCount}`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

run();
