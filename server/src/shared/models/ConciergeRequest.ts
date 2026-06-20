import mongoose, { Schema, Document } from "mongoose";

export interface IConciergeRequest extends Document {
  userId: mongoose.Types.ObjectId;
  sportSlug: string;
  itemType?: "tournament" | "scholarship" | "university";
  itemId?: string;
  itemName?: string;
  tournamentId?: string; // Kept for backwards compatibility
  tournamentName?: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  documents: Array<{
    documentName: string;
    s3Key: string;
  }>;
  status: "pending" | "processing" | "completed" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const ConciergeRequestSchema = new Schema<IConciergeRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sportSlug: { type: String, required: true },
    itemType: { type: String, enum: ["tournament", "scholarship", "university"] },
    itemId: { type: String },
    itemName: { type: String },
    tournamentId: { type: String },
    tournamentName: { type: String },
    prerequisiteId: { type: String },
    prerequisiteName: { type: String },
    documents: [
      {
        documentName: { type: String, required: true },
        s3Key: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const ConciergeRequest = mongoose.model<IConciergeRequest>(
  "ConciergeRequest",
  ConciergeRequestSchema
);
