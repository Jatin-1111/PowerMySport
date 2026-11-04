/**
 * Embed the RAG knowledge base sources and upsert them into KnowledgeChunk.
 *
 * Run: npx ts-node src/scripts/embedKnowledgeBase.ts
 * Safe to re-run — upserts by (sourceType, sourceId), so existing entries are
 * refreshed with new embeddings and new entries are added.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { KnowledgeChunk } from "../shared/models/KnowledgeChunk";
import { KNOWLEDGE_BASE_SOURCES } from "../shared/config/knowledgeBaseSources";
import { embedText } from "../shared/services/knowledgeRetrievalService";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";

async function main() {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI/MONGODB_URI environment variable");
  }

  await mongoose.connect(MONGO_URI);
  console.log(
    `Connected to MongoDB. Embedding ${KNOWLEDGE_BASE_SOURCES.length} knowledge chunks...`
  );

  let succeeded = 0;
  let failed = 0;

  for (const entry of KNOWLEDGE_BASE_SOURCES) {
    try {
      const embedding = await embedText(`${entry.title}\n${entry.content}`);
      await KnowledgeChunk.updateOne(
        { sourceType: entry.sourceType, sourceId: entry.sourceId },
        {
          $set: {
            title: entry.title,
            content: entry.content,
            embedding,
          },
        },
        { upsert: true }
      );
      succeeded++;
      console.log(`  ✓ ${entry.sourceId}`);
    } catch (error) {
      failed++;
      console.error(`  ✗ ${entry.sourceId}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Done. ${succeeded} embedded, ${failed} failed.`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
