import mongoose from "mongoose";
import dotenv from "dotenv";
import { Player } from "../client/models/Player";
import { GuidanceSubmission } from "../client/models/GuidanceSubmission";

dotenv.config();

/**
 * Migration: Narrow the primaryObjective / primary_objective enum from
 * ["Recreational", "Health", "Social", "Competitive"] to
 * ["Recreational", "Fitness", "Compete"] on both Player and
 * GuidanceSubmission documents, remapping existing values:
 *   Health      -> Fitness      (rename)
 *   Social      -> Recreational (closest fit — casual/social play reads as recreational)
 *   Competitive -> Compete      (rename)
 */
const REMAP: Record<string, string> = {
  Health: "Fitness",
  Social: "Recreational",
  Competitive: "Compete",
};

export async function up(): Promise<void> {
  console.log("Starting migration: Remap primaryObjective enum to Recreational/Fitness/Compete...");

  try {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/powermysport";
      await mongoose.connect(mongoUri);
      console.log("Connected to database");
    }

    for (const [oldValue, newValue] of Object.entries(REMAP)) {
      const playerResult = await Player.updateMany(
        { primaryObjective: oldValue },
        { $set: { primaryObjective: newValue } },
      );
      console.log(
        `- Player.primaryObjective: ${oldValue} -> ${newValue} (${playerResult.modifiedCount} updated)`,
      );

      const guidanceResult = await GuidanceSubmission.updateMany(
        { "request.primary_objective": oldValue },
        { $set: { "request.primary_objective": newValue } },
      );
      console.log(
        `- GuidanceSubmission.request.primary_objective: ${oldValue} -> ${newValue} (${guidanceResult.modifiedCount} updated)`,
      );
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback is a best-effort reverse mapping. Since both "Social" and no
 * other old value collapse onto "Recreational", this cannot distinguish
 * originally-Recreational documents from originally-Social ones — the
 * reverse of the Social->Recreational step is intentionally omitted.
 */
export async function down(): Promise<void> {
  console.log("Rolling back migration: Remap primaryObjective enum...");

  try {
    const playerResult = await Player.updateMany(
      { primaryObjective: "Fitness" },
      { $set: { primaryObjective: "Health" } },
    );
    const playerResult2 = await Player.updateMany(
      { primaryObjective: "Compete" },
      { $set: { primaryObjective: "Competitive" } },
    );
    const guidanceResult = await GuidanceSubmission.updateMany(
      { "request.primary_objective": "Fitness" },
      { $set: { "request.primary_objective": "Health" } },
    );
    const guidanceResult2 = await GuidanceSubmission.updateMany(
      { "request.primary_objective": "Compete" },
      { $set: { "request.primary_objective": "Competitive" } },
    );

    console.log(
      `Rollback completed: Player Fitness->Health (${playerResult.modifiedCount}), Player Compete->Competitive (${playerResult2.modifiedCount}), GuidanceSubmission Fitness->Health (${guidanceResult.modifiedCount}), GuidanceSubmission Compete->Competitive (${guidanceResult2.modifiedCount}). Social->Recreational is not reversible.`,
    );
  } catch (error) {
    console.error("Rollback failed:", error);
    throw error;
  }
}

if (require.main === module) {
  const runMigration = async () => {
    try {
      const mongoUri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/powermysport";
      await mongoose.connect(mongoUri);
      console.log("Connected to MongoDB");

      await up();

      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
      process.exit(0);
    } catch (error) {
      console.error("Migration script failed:", error);
      process.exit(1);
    }
  };

  runMigration();
}
