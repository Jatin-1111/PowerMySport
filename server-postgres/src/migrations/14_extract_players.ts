import mongoose from "mongoose";
import dotenv from "dotenv";
import { Player } from "../client/models/Player";

dotenv.config();

export const up = async () => {
  console.log(
    "🔥 Initiating Migration: Extracting Legacy Player Profiles and Dependents...",
  );

  // We use the native MongoDB driver collection to bypass Mongoose schemas,
  // as the fields (playerProfile, dependents, venueListerProfile) are already removed from the schema.
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("No database connection");
  }

  const usersCollection = db.collection("users");

  // Find all users that might have legacy fields
  const users = await usersCollection
    .find({
      $or: [
        { playerProfile: { $exists: true } },
        { dependents: { $exists: true, $not: { $size: 0 } } },
        { venueListerProfile: { $exists: true } },
      ],
    })
    .toArray();

  console.log(`📊 Found ${users.length} users requiring extraction migration.`);

  let playersCreated = 0;
  let dependentsCreated = 0;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const user of users) {
      const updates: any = { $unset: {} };

      // 1. Extract Self Profile
      if (user.playerProfile) {
        await Player.updateOne(
          { userId: user._id, type: "SELF" },
          {
            $setOnInsert: {
              userId: user._id,
              type: "SELF",
              name: user.name,
              age: user.dob
                ? Math.floor(
                    (new Date().getTime() - new Date(user.dob).getTime()) /
                      31557600000,
                  )
                : null,
              sports: user.playerProfile.sports || [],
              skillLevel: user.playerProfile.skillLevel || "BEGINNER",
              gender: user.playerProfile.gender || "PREFER_NOT_TO_SAY",
            },
          },
          { upsert: true, session },
        );
        updates.$unset.playerProfile = "";
        playersCreated++;
      }

      // 2. Extract Dependents
      if (
        user.dependents &&
        Array.isArray(user.dependents) &&
        user.dependents.length > 0
      ) {
        for (const dep of user.dependents) {
          // If the dependent doesn't have an ID (which might be possible in legacy data), generate a new ObjectId
          const dependentId = dep._id || new mongoose.Types.ObjectId();

          await Player.updateOne(
            { _id: dependentId },
            {
              $setOnInsert: {
                _id: dependentId,
                userId: user._id,
                type: "DEPENDENT",
                name: dep.name,
                age: dep.age || null,
                gender: dep.gender || "PREFER_NOT_TO_SAY",
                sports: dep.sports || [],
                skillLevel: dep.skillLevel || "BEGINNER",
              },
            },
            { upsert: true, session },
          );
          dependentsCreated++;
        }
        updates.$unset.dependents = "";
      }

      // 3. Remove venueListerProfile
      if (user.venueListerProfile) {
        updates.$unset.venueListerProfile = "";
      }

      // Apply unsets to clean the document
      if (Object.keys(updates.$unset).length > 0) {
        await usersCollection.updateOne({ _id: user._id }, updates, {
          session,
        });
      }
    }

    await session.commitTransaction();
    console.log(
      `✅ Extracted ${playersCreated} SELF profiles into Player collection.`,
    );
    console.log(
      `✅ Extracted ${dependentsCreated} DEPENDENT profiles into Player collection.`,
    );
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
  console.log(
    "⚠️ Rollback for structural extraction is manual and currently unsupported.",
  );
};

// Run if called directly
if (require.main === module) {
  import("../config/database").then(({ connectDB }) => {
    connectDB().then(() => {
      up()
        .then(() => {
          process.exit(0);
        })
        .catch((error) => {
          process.exit(1);
        });
    });
  });
}
