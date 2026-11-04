import mongoose, { Document, Schema } from "mongoose";

export interface KnowledgeChunkDocument extends Document {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeChunkSchema = new Schema<KnowledgeChunkDocument>(
  {
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

// One chunk per (sourceType, sourceId) — re-ingesting the same source updates it in place.
knowledgeChunkSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });

export const KnowledgeChunk = mongoose.model<KnowledgeChunkDocument>(
  "KnowledgeChunk",
  knowledgeChunkSchema
);
