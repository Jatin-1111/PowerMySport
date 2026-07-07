import mongoose from "mongoose";
import { User } from "../client/models/User";
import { Booking } from "../client/models/Booking";

export const up = async () => {
  console.log("🔥 Initiating Structural Pivot: Parent-Dependent Model...");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Migrate Existing Users
    // Mongoose array pipeline requires specific flags or newer versions.
    // It's much safer and equally fast to just do two targeted updates.
    const userUpdate1 = await User.updateMany(
      { userType: { $exists: false } },
      { $set: { userType: "Recreational" } },
      { session },
    );

    const userUpdate2 = await User.updateMany(
      { dependents: { $exists: false } },
      { $set: { dependents: [] } },
      { session },
    );
    console.log(`✅ Users Patched (userType): ${userUpdate1.modifiedCount}`);
    console.log(`✅ Users Patched (dependents): ${userUpdate2.modifiedCount}`);

    // 2. Migrate Bookings (AI's logic here was clean)
    const bookingUpdate = await Booking.updateMany(
      { participantId: { $exists: false } },
      {
        $set: {
          participantId: null, // Null means the master account user (Parent/Recreational) is playing
        },
      },
      { session },
    );
    console.log(
      `✅ Bookings Patched (participantId normalized): ${bookingUpdate.modifiedCount}`,
    );

    await session.commitTransaction();
    console.log("🚀 Migration Completed Successfully.");
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Migration Failed. Rolling back.", error);
    throw error;
  } finally {
    session.endSession();
  }
};

export const down = async () => {
  console.log("⚠️ Rollback initiated. Reverting schema changes...");
  // Add fallback logic here if needed
};
