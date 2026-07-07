import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";

dotenv.config();

export const migrateCommunitySchemas = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB database connection is not available");
    }

    // 1. Migrate CommunityConversation
    const conversationCollection = db.collection("communityconversations");
    const conversationUpdateResult = await conversationCollection.updateMany(
      { conversationType: { $exists: false } },
      { $set: { conversationType: "DM" } },
    );
    const conversationStatusUpdateResult =
      await conversationCollection.updateMany(
        { status: { $exists: false } },
        { $set: { status: "ACTIVE" } },
      );
    console.log(
      `✓ Migrated ${conversationUpdateResult.modifiedCount} conversations to have conversationType`,
    );
    console.log(
      `✓ Migrated ${conversationStatusUpdateResult.modifiedCount} conversations to have status`,
    );

    // 2. Migrate CommunityMessage
    const messageCollection = db.collection("communitymessages");
    const messageUpdateResult = await messageCollection.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } },
    );
    console.log(
      `✓ Migrated ${messageUpdateResult.modifiedCount} messages to have isDeleted flag`,
    );

    // 3. Migrate CommunityGroup
    const groupCollection = db.collection("communitygroups");
    const groupAudienceUpdateResult = await groupCollection.updateMany(
      { audience: { $exists: false } },
      { $set: { audience: "ALL" } },
    );
    const groupMemberPolicyUpdateResult = await groupCollection.updateMany(
      { memberAddPolicy: { $exists: false } },
      { $set: { memberAddPolicy: "ADMIN_ONLY" } },
    );
    console.log(
      `✓ Migrated ${groupAudienceUpdateResult.modifiedCount} groups to have audience policy`,
    );
    console.log(
      `✓ Migrated ${groupMemberPolicyUpdateResult.modifiedCount} groups to have memberAddPolicy`,
    );

    console.log("✓ Successfully migrated all community schemas");
  } catch (error) {
    console.error("❌ Failed to migrate community schemas:", error);
    throw error;
  }
};

if (require.main === module) {
  migrateCommunitySchemas()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
