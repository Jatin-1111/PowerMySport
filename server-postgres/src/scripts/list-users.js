/**
 * Quick script to list existing users for testing
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function listUsers() {
  try {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";
    await mongoose.connect(mongoUri);
    console.log("Connected to database\n");

    const users = await mongoose.connection.db
      .collection("users")
      .find({})
      .limit(10)
      .toArray();

    console.log(`Found ${users.length} users:\n`);
    users.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.name} (${user.email}) - ${user.role}`,
      );
      console.log(`   ID: ${user._id}\n`);
    });

    await mongoose.disconnect();
    console.log("\nDisconnected from database");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

listUsers();
