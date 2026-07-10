/**
 * Migration: Fix CommunityConversation participantKey index
 *
 * The legacy index allowed group conversations to collide on participantKey null/missing values.
 * This migration removes any old participantKey index and recreates it as a DM-only partial unique index.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database";

dotenv.config();

const COLLECTION_NAME = "communityconversations";
const NEW_INDEX_NAME = "participantKey_dm_unique";

export const fixCommunityConversationIndexes = async (): Promise<{
  droppedIndexes: string[];
  createdIndex: boolean;
}> => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB database connection is not available");
    }

    const collection = db.collection(COLLECTION_NAME);
    const indexes = await collection.indexes();
    const droppedIndexes: string[] = [];

    for (const index of indexes) {
      if (index.name === "_id_") {
        continue;
      }

      if (!index.name) {
        continue;
      }

      const keyFields = Object.keys(index.key || {});
      if (!keyFields.includes("participantKey")) {
        continue;
      }

      await collection.dropIndex(index.name);
      droppedIndexes.push(index.name);
      console.log(`✓ Dropped stale index: ${index.name}`);
    }

    await collection.createIndex(
      { participantKey: 1 },
      {
        unique: true,
        name: NEW_INDEX_NAME,
        partialFilterExpression: {
          conversationType: "DM",
          participantKey: { $type: "string" },
        },
      },
    );

    console.log(`✓ Created index: ${NEW_INDEX_NAME}`);

    return { droppedIndexes, createdIndex: true };
  } catch (error) {
    console.error("❌ Failed to fix community conversation indexes:", error);
    throw error;
  }
};

export const down = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB database connection is not available");
    }

    const collection = db.collection(COLLECTION_NAME);
    const indexes = await collection.indexes();

    for (const index of indexes) {
      if (index.name === NEW_INDEX_NAME) {
        await collection.dropIndex(index.name);
        console.log(`✓ Dropped index: ${index.name}`);
      }
    }
  } catch (error) {
    console.error(
      "❌ Rollback failed for community conversation indexes:",
      error,
    );
    throw error;
  }
};

if (require.main === module) {
  fixCommunityConversationIndexes()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
