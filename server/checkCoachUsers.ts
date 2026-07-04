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
    const coaches = await usersCollection.find({ role: "Coach" }).toArray();
    
    console.log(`There are ${coaches.length} users with role 'Coach' in the database.`);
    
    // We can recreate empty coach profiles for them
    for (const coachUser of coaches) {
      console.log(`- Coach User: ${coachUser.name} (${coachUser.email}) ID: ${coachUser._id}`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
